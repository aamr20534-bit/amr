package com.amr.filemanager;

import android.Manifest;
import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.MediaScannerConnection;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import android.database.ContentObserver;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.pdf.PdfRenderer;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelFileDescriptor;
import android.os.StatFs;
import android.provider.DocumentsContract;
import android.provider.DocumentsContract.Document;
import android.provider.MediaStore;
import android.util.Base64;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayDeque;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * AmrFS: real file access for AMR FILE MANAGER.
 * - Folders are chosen by the user (ACTION_OPEN_DOCUMENT_TREE) and kept with persistable URI permissions (SAF).
 * - Recent media comes from MediaStore (needs READ_MEDIA_* / READ_EXTERNAL_STORAGE).
 * - Storage numbers come from StatFs (real device values).
 */
@CapacitorPlugin(
    name = "AmrFS",
    permissions = {
        @Permission(alias = "media", strings = {Manifest.permission.READ_MEDIA_IMAGES, Manifest.permission.READ_MEDIA_VIDEO, Manifest.permission.READ_MEDIA_AUDIO}),
        @Permission(alias = "storage", strings = {Manifest.permission.READ_EXTERNAL_STORAGE}),
        @Permission(alias = "legacy", strings = {Manifest.permission.READ_EXTERNAL_STORAGE, Manifest.permission.WRITE_EXTERNAL_STORAGE})
    }
)
public class AmrFSPlugin extends Plugin {
    private static final String[] COLS = {
        Document.COLUMN_DOCUMENT_ID, Document.COLUMN_DISPLAY_NAME, Document.COLUMN_MIME_TYPE,
        Document.COLUMN_SIZE, Document.COLUMN_LAST_MODIFIED
    };
    private final ExecutorService pool = Executors.newFixedThreadPool(2);
    private final Object pdfLock = new Object();
    private final Map<String, ContentObserver> observers = new HashMap<>();

    private ContentResolver cr() { return getContext().getContentResolver(); }
    private String permAlias() { return Build.VERSION.SDK_INT >= 33 ? "media" : "storage"; }

    /* ---------------- roots ---------------- */
    @PluginMethod
    public void pickFolder(PluginCall call) {
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
        startActivityForResult(call, i, "pickResult");
    }

    @ActivityCallback
    private void pickResult(PluginCall call, ActivityResult r) {
        if (call == null) return;
        if (r.getResultCode() != Activity.RESULT_OK || r.getData() == null || r.getData().getData() == null) {
            call.reject("cancelled");
            return;
        }
        Uri tree = r.getData().getData();
        try {
            cr().takePersistableUriPermission(tree, Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            call.resolve(rootObj(tree));
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
        }
    }

    private JSObject rootObj(Uri tree) {
        String docId = DocumentsContract.getTreeDocumentId(tree);
        Uri doc = DocumentsContract.buildDocumentUriUsingTree(tree, docId);
        String name = displayName(doc);
        if (name == null || name.isEmpty()) {
            int k = docId.lastIndexOf(':');
            name = k >= 0 && k < docId.length() - 1 ? docId.substring(k + 1) : docId;
        }
        JSObject o = new JSObject();
        o.put("tree", tree.toString());
        o.put("doc", doc.toString());
        o.put("name", name);
        return o;
    }

    @PluginMethod
    public void getRoots(PluginCall call) {
        JSArray arr = new JSArray();
        for (android.content.UriPermission p : cr().getPersistedUriPermissions()) {
            Uri u = p.getUri();
            if (DocumentsContract.isTreeUri(u) && p.isWritePermission()) {
                try { arr.put(rootObj(u)); } catch (Exception ignored) { }
            }
        }
        JSObject o = new JSObject();
        o.put("roots", arr);
        call.resolve(o);
    }

    @PluginMethod
    public void releaseRoot(PluginCall call) {
        try {
            cr().releasePersistableUriPermission(Uri.parse(call.getString("tree")),
                Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            call.resolve();
        } catch (Exception e) { call.reject(String.valueOf(e.getMessage())); }
    }

    /* ---------------- listing / scanning ---------------- */
    private JSObject item(Uri tree, String parentDoc, Cursor c) {
        String id = c.getString(0);
        String mime = c.getString(2);
        JSObject o = new JSObject();
        o.put("id", DocumentsContract.buildDocumentUriUsingTree(tree, id).toString());
        o.put("name", c.getString(1));
        o.put("dir", Document.MIME_TYPE_DIR.equals(mime));
        o.put("mime", mime == null ? "" : mime);
        o.put("size", c.isNull(3) ? 0 : c.getLong(3));
        o.put("mod", c.isNull(4) ? 0 : c.getLong(4));
        o.put("parent", parentDoc);
        return o;
    }

    private JSArray listDir(Uri tree, String docStr) {
        Uri doc = Uri.parse(docStr);
        Uri ch = DocumentsContract.buildChildDocumentsUriUsingTree(tree, DocumentsContract.getDocumentId(doc));
        JSArray arr = new JSArray();
        try (Cursor c = cr().query(ch, COLS, null, null, null)) {
            while (c != null && c.moveToNext()) arr.put(item(tree, docStr, c));
        }
        return arr;
    }

    @PluginMethod
    public void list(PluginCall call) {
        pool.execute(() -> {
            try {
                JSObject o = new JSObject();
                o.put("items", listDir(Uri.parse(call.getString("tree")), call.getString("doc")));
                call.resolve(o);
            } catch (Exception e) { call.reject(String.valueOf(e.getMessage())); }
        });
    }

    /** Breadth-first scan (parents are always emitted before children). Emits "scan" events with chunks. */
    @PluginMethod
    public void scan(PluginCall call) {
        final Uri tree = Uri.parse(call.getString("tree"));
        final String start = call.getString("doc");
        final String sid = call.getString("sid");
        final String skip = call.getString("skip", "");
        pool.execute(() -> {
            try {
                ArrayDeque<String> q = new ArrayDeque<>();
                q.add(start);
                int total = 0;
                while (!q.isEmpty()) {
                    String cur = q.poll();
                    JSArray all;
                    try { all = listDir(tree, cur); } catch (Exception e) { continue; }
                    JSArray chunk = new JSArray();
                    for (int i = 0; i < all.length(); i++) {
                        JSObject it = JSObject.fromJSONObject(all.getJSONObject(i));
                        boolean dir = it.getBoolean("dir");
                        if (dir && !skip.isEmpty() && skip.equals(it.getString("name"))) continue;
                        chunk.put(it);
                        total++;
                        if (dir) q.add(it.getString("id"));
                        if (chunk.length() >= 500) { emit(sid, chunk); chunk = new JSArray(); }
                    }
                    if (chunk.length() > 0) emit(sid, chunk);
                }
                JSObject r = new JSObject();
                r.put("count", total);
                call.resolve(r);
            } catch (Exception e) { call.reject(String.valueOf(e.getMessage())); }
        });
    }

    private void emit(String sid, JSArray items) {
        JSObject ev = new JSObject();
        ev.put("sid", sid);
        ev.put("items", items);
        notifyListeners("scan", ev);
    }

    /* ---------------- file operations ---------------- */
    private String displayName(Uri doc) {
        try (Cursor c = cr().query(doc, new String[]{Document.COLUMN_DISPLAY_NAME}, null, null, null)) {
            if (c != null && c.moveToFirst()) return c.getString(0);
        } catch (Exception ignored) { }
        return null;
    }

    private String mimeOf(Uri doc) {
        try (Cursor c = cr().query(doc, new String[]{Document.COLUMN_MIME_TYPE}, null, null, null)) {
            if (c != null && c.moveToFirst()) return c.getString(0);
        } catch (Exception ignored) { }
        return null;
    }

    private JSObject idObj(Uri u) {
        JSObject o = new JSObject();
        o.put("id", u.toString());
        return o;
    }

    @PluginMethod
    public void mkdir(PluginCall call) {
        pool.execute(() -> {
            try {
                Uri u = DocumentsContract.createDocument(cr(), Uri.parse(call.getString("parent")), Document.MIME_TYPE_DIR, call.getString("name"));
                if (u == null) throw new IOException("mkdir failed");
                call.resolve(idObj(u));
            } catch (Exception e) { call.reject(String.valueOf(e.getMessage())); }
        });
    }

    @PluginMethod
    public void rename(PluginCall call) {
        pool.execute(() -> {
            try {
                Uri src = Uri.parse(call.getString("id"));
                Uri u = DocumentsContract.renameDocument(cr(), src, call.getString("name"));
                if (u == null) throw new IOException("rename failed");
                call.resolve(idObj(u));
            } catch (Exception e) { call.reject(String.valueOf(e.getMessage())); }
        });
    }

    @PluginMethod
    public void delete(PluginCall call) {
        pool.execute(() -> {
            try {
                if (!DocumentsContract.deleteDocument(cr(), Uri.parse(call.getString("id")))) throw new IOException("delete failed");
                call.resolve();
            } catch (Exception e) { call.reject(String.valueOf(e.getMessage())); }
        });
    }

    /** Recursive copy using streams (works across providers and lets us choose the final name). */
    private Uri copyTo(Uri src, Uri destParent, String name) throws IOException {
        String mime = mimeOf(src);
        if (Document.MIME_TYPE_DIR.equals(mime)) {
            Uri nd = DocumentsContract.createDocument(cr(), destParent, Document.MIME_TYPE_DIR, name);
            if (nd == null) throw new IOException("create folder failed");
            Uri ch = DocumentsContract.buildChildDocumentsUriUsingTree(src, DocumentsContract.getDocumentId(src));
            try (Cursor c = cr().query(ch, COLS, null, null, null)) {
                while (c != null && c.moveToNext()) {
                    copyTo(DocumentsContract.buildDocumentUriUsingTree(src, c.getString(0)), nd, c.getString(1));
                }
            }
            return nd;
        }
        Uri nf = DocumentsContract.createDocument(cr(), destParent, mime == null ? "application/octet-stream" : mime, name);
        if (nf == null) throw new IOException("create file failed");
        try (InputStream in = cr().openInputStream(src); OutputStream out = cr().openOutputStream(nf)) {
            if (in == null || out == null) throw new IOException("stream unavailable");
            byte[] b = new byte[65536];
            int n;
            while ((n = in.read(b)) > 0) out.write(b, 0, n);
        }
        return nf;
    }

    @PluginMethod
    public void copy(PluginCall call) {
        pool.execute(() -> {
            try {
                call.resolve(idObj(copyTo(Uri.parse(call.getString("id")), Uri.parse(call.getString("dest")), call.getString("name"))));
            } catch (Exception e) { call.reject(String.valueOf(e.getMessage())); }
        });
    }

    @PluginMethod
    public void move(PluginCall call) {
        pool.execute(() -> {
            try {
                Uri src = Uri.parse(call.getString("id"));
                Uri srcParent = Uri.parse(call.getString("src"));
                Uri dest = Uri.parse(call.getString("dest"));
                Uri res = null;
                try { res = DocumentsContract.moveDocument(cr(), src, srcParent, dest); } catch (Exception ignored) { }
                if (res == null) { // provider cannot move: copy then delete
                    String name = displayName(src);
                    res = copyTo(src, dest, name == null ? "file" : name);
                    if (!DocumentsContract.deleteDocument(cr(), src)) throw new IOException("delete source failed");
                }
                call.resolve(idObj(res));
            } catch (Exception e) { call.reject(String.valueOf(e.getMessage())); }
        });
    }

    @PluginMethod
    public void write(PluginCall call) {
        pool.execute(() -> {
            try {
                byte[] data = Base64.decode(call.getString("data", ""), Base64.DEFAULT);
                Uri nf = DocumentsContract.createDocument(cr(), Uri.parse(call.getString("parent")), call.getString("mime", "application/octet-stream"), call.getString("name"));
                if (nf == null) throw new IOException("create file failed");
                try (OutputStream out = cr().openOutputStream(nf)) {
                    if (out == null) throw new IOException("stream unavailable");
                    out.write(data);
                }
                call.resolve(idObj(nf));
            } catch (Exception e) { call.reject(String.valueOf(e.getMessage())); }
        });
    }

    @PluginMethod
    public void readBase64(PluginCall call) {
        pool.execute(() -> {
            try (InputStream in = cr().openInputStream(uriOf(call.getString("id")))) {
                if (in == null) throw new IOException("stream unavailable");
                ByteArrayOutputStream bo = new ByteArrayOutputStream();
                byte[] b = new byte[65536];
                int n;
                while ((n = in.read(b)) > 0) {
                    bo.write(b, 0, n);
                    if (bo.size() > 64 * 1024 * 1024) throw new IOException("file too large");
                }
                JSObject o = new JSObject();
                o.put("data", Base64.encodeToString(bo.toByteArray(), Base64.NO_WRAP));
                call.resolve(o);
            } catch (Exception e) { call.reject(String.valueOf(e.getMessage())); }
        });
    }

    /* ---------------- open / share ---------------- */
    @PluginMethod
    public void open(PluginCall call) {
        try {
            Intent i = new Intent(Intent.ACTION_VIEW);
            i.setDataAndType(Uri.parse(call.getString("id")), call.getString("mime", "*/*"));
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(Intent.createChooser(i, null));
            call.resolve();
        } catch (Exception e) { call.reject(String.valueOf(e.getMessage())); }
    }

    @PluginMethod
    public void share(PluginCall call) {
        try {
            Intent i = new Intent(Intent.ACTION_SEND);
            i.setType(call.getString("mime", "*/*"));
            i.putExtra(Intent.EXTRA_STREAM, Uri.parse(call.getString("id")));
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(Intent.createChooser(i, null));
            call.resolve();
        } catch (Exception e) { call.reject(String.valueOf(e.getMessage())); }
    }

    /* ---------------- storage ---------------- */
    @PluginMethod
    public void storage(PluginCall call) {
        try {
            StatFs s = new StatFs(Environment.getExternalStorageDirectory().getPath());
            JSObject o = new JSObject();
            o.put("total", s.getTotalBytes());
            o.put("free", s.getAvailableBytes());
            call.resolve(o);
        } catch (Exception e) { call.reject(String.valueOf(e.getMessage())); }
    }

    /* ---------------- change observer (new files) ---------------- */
    @PluginMethod
    public void watch(PluginCall call) {
        try {
            final String treeStr = call.getString("tree");
            if (treeStr == null) {
                // All-files mode (real paths, no SAF tree): watch MediaStore so new/removed files are noticed within seconds.
                if (!observers.containsKey("__all__")) {
                    ContentObserver ob = new ContentObserver(new Handler(Looper.getMainLooper())) {
                        @Override public void onChange(boolean selfChange) { notifyListeners("changed", new JSObject()); }
                    };
                    cr().registerContentObserver(MediaStore.Files.getContentUri("external"), true, ob);
                    observers.put("__all__", ob);
                }
                call.resolve();
                return;
            }
            if (!observers.containsKey(treeStr)) {
                Uri tree = Uri.parse(treeStr);
                Uri ch = DocumentsContract.buildChildDocumentsUriUsingTree(tree, DocumentsContract.getDocumentId(Uri.parse(call.getString("doc"))));
                ContentObserver ob = new ContentObserver(new Handler(Looper.getMainLooper())) {
                    @Override public void onChange(boolean selfChange) { notifyListeners("changed", new JSObject()); }
                };
                cr().registerContentObserver(ch, true, ob);
                observers.put(treeStr, ob);
            }
            call.resolve();
        } catch (Exception e) { call.reject(String.valueOf(e.getMessage())); }
    }

    @Override
    protected void handleOnDestroy() {
        for (ContentObserver o : observers.values()) cr().unregisterContentObserver(o);
        observers.clear();
        pool.shutdown();
    }

    /* ---------------- PDF rendering (PdfRenderer) ---------------- */
    @PluginMethod
    public void pdfInfo(PluginCall call) {
        pool.execute(() -> {
            synchronized (pdfLock) {
                ParcelFileDescriptor pfd = null;
                PdfRenderer r = null;
                try {
                    pfd = cr().openFileDescriptor(uriOf(call.getString("id")), "r");
                    r = new PdfRenderer(pfd);
                    JSObject o = new JSObject();
                    o.put("pages", r.getPageCount());
                    call.resolve(o);
                } catch (Exception e) {
                    call.reject(String.valueOf(e.getMessage()));
                } finally {
                    if (r != null) r.close();
                    try { if (pfd != null) pfd.close(); } catch (IOException ignored) { }
                }
            }
        });
    }

    @PluginMethod
    public void pdfPage(PluginCall call) {
        pool.execute(() -> {
            synchronized (pdfLock) {
                ParcelFileDescriptor pfd = null;
                PdfRenderer r = null;
                PdfRenderer.Page p = null;
                try {
                    pfd = cr().openFileDescriptor(uriOf(call.getString("id")), "r");
                    r = new PdfRenderer(pfd);
                    int w = Math.max(200, Math.min(call.getInt("width", 1080), 2000));
                    p = r.openPage(call.getInt("page", 0));
                    int h = Math.max(1, Math.round((float) w * p.getHeight() / p.getWidth()));
                    Bitmap bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
                    bmp.eraseColor(Color.WHITE);
                    p.render(bmp, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY);
                    ByteArrayOutputStream bo = new ByteArrayOutputStream();
                    bmp.compress(Bitmap.CompressFormat.PNG, 100, bo);
                    bmp.recycle();
                    JSObject o = new JSObject();
                    o.put("data", Base64.encodeToString(bo.toByteArray(), Base64.NO_WRAP));
                    call.resolve(o);
                } catch (Exception e) {
                    call.reject(String.valueOf(e.getMessage()));
                } finally {
                    if (p != null) p.close();
                    if (r != null) r.close();
                    try { if (pfd != null) pfd.close(); } catch (IOException ignored) { }
                }
            }
        });
    }


    /* ================= All-files access (java.io.File) =================
     * Like a classic file manager: after the user allows "All files access" (Android 11+) or storage permission (Android 10-),
     * the whole internal storage is browsed with real paths. Ids are absolute paths. */
    private Uri uriOf(String id) { return id.startsWith("/") ? Uri.fromFile(new File(id)) : Uri.parse(id); }

    private boolean allFiles() {
        if (Build.VERSION.SDK_INT >= 30) return Environment.isExternalStorageManager();
        return getContext().checkSelfPermission(Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED
            && getContext().checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED;
    }

    private void granted(PluginCall call) {
        JSObject o = new JSObject();
        o.put("granted", allFiles());
        call.resolve(o);
    }

    @PluginMethod
    public void hasAllFiles(PluginCall call) { granted(call); }

    @PluginMethod
    public void storageRoot(PluginCall call) {
        JSObject o = new JSObject();
        o.put("path", Environment.getExternalStorageDirectory().getAbsolutePath());
        call.resolve(o);
    }

    @PluginMethod
    public void requestAllFiles(PluginCall call) {
        if (allFiles()) { granted(call); return; }
        if (Build.VERSION.SDK_INT >= 30) {
            try {
                startActivityForResult(call, new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION,
                    Uri.parse("package:" + getContext().getPackageName())), "allFilesResult");
            } catch (Exception e) {
                startActivityForResult(call, new Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION), "allFilesResult");
            }
        } else {
            requestPermissionForAlias("legacy", call, "legacyPerm");
        }
    }

    @ActivityCallback
    private void allFilesResult(PluginCall call, ActivityResult r) { if (call != null) granted(call); }

    @PermissionCallback
    private void legacyPerm(PluginCall call) { granted(call); }

    private JSObject fitem(File f, String parent) {
        JSObject o = new JSObject();
        o.put("id", f.getAbsolutePath());
        o.put("name", f.getName());
        o.put("dir", f.isDirectory());
        o.put("size", f.isDirectory() ? 0 : f.length());
        o.put("mod", f.lastModified());
        o.put("parent", parent);
        return o;
    }

    private void mediaScan(String... paths) {
        try { MediaScannerConnection.scanFile(getContext(), paths, null, null); } catch (Exception ignored) { }
    }

    @PluginMethod
    public void fList(PluginCall call) {
        pool.execute(() -> {
            try {
                String path = call.getString("path");
                File[] fs = new File(path).listFiles();
                JSArray a = new JSArray();
                if (fs != null) for (File f : fs) if (!f.getName().startsWith(".")) a.put(fitem(f, path));
                JSObject o = new JSObject();
                o.put("items", a);
                call.resolve(o);
            } catch (Exception e) { call.reject(String.valueOf(e.getMessage())); }
        });
    }

    @PluginMethod
    public void fScan(PluginCall call) {
        final String start = call.getString("path"), sid = call.getString("sid");
        pool.execute(() -> {
            try {
                ArrayDeque<String> q = new ArrayDeque<>();
                q.add(start);
                int total = 0;
                while (!q.isEmpty()) {
                    String cur = q.poll();
                    File[] fs = new File(cur).listFiles();
                    if (fs == null) continue;
                    JSArray chunk = new JSArray();
                    for (File f : fs) {
                        if (f.getName().startsWith(".")) continue;
                        chunk.put(fitem(f, cur));
                        total++;
                        if (f.isDirectory()) q.add(f.getAbsolutePath());
                        if (chunk.length() >= 500) { emit(sid, chunk); chunk = new JSArray(); }
                    }
                    if (chunk.length() > 0) emit(sid, chunk);
                }
                JSObject r = new JSObject();
                r.put("count", total);
                call.resolve(r);
            } catch (Exception e) { call.reject(String.valueOf(e.getMessage())); }
        });
    }

    private JSObject pathObj(File f) {
        JSObject o = new JSObject();
        o.put("id", f.getAbsolutePath());
        return o;
    }

    @PluginMethod
    public void fTrash(PluginCall call) {
        try {
            File d = new File(call.getString("root"), ".amr_trash");
            if (!d.isDirectory() && !d.mkdirs()) throw new IOException("cannot create trash folder");
            File nm = new File(d, ".nomedia");
            if (!nm.exists()) nm.createNewFile();
            call.resolve(pathObj(d));
        } catch (Exception e) { call.reject(String.valueOf(e.getMessage())); }
    }

    @PluginMethod
    public void fMkdir(PluginCall call) {
        try {
            File d = new File(call.getString("parent"), call.getString("name"));
            if (!d.mkdir() && !d.isDirectory()) throw new IOException("mkdir failed");
            call.resolve(pathObj(d));
        } catch (Exception e) { call.reject(String.valueOf(e.getMessage())); }
    }

    @PluginMethod
    public void fRename(PluginCall call) {
        try {
            File f = new File(call.getString("id"));
            File t = new File(f.getParentFile(), call.getString("name"));
            if (!f.exists()) throw new IOException("not found");
            if (t.exists()) throw new IOException("already exists");
            if (!f.renameTo(t)) throw new IOException("rename failed");
            mediaScan(f.getAbsolutePath(), t.getAbsolutePath());
            call.resolve(pathObj(t));
        } catch (Exception e) { call.reject(String.valueOf(e.getMessage())); }
    }

    private boolean delRec(File f) {
        File[] k = f.listFiles();
        if (k != null) for (File c : k) delRec(c);
        return f.delete();
    }

    @PluginMethod
    public void fDelete(PluginCall call) {
        pool.execute(() -> {
            try {
                File f = new File(call.getString("id"));
                if (!f.exists()) throw new IOException("not found");
                if (!delRec(f)) throw new IOException("delete failed");
                mediaScan(f.getAbsolutePath());
                call.resolve();
            } catch (Exception e) { call.reject(String.valueOf(e.getMessage())); }
        });
    }

    private void copyRec(File s, File d) throws IOException {
        if (s.isDirectory()) {
            if (!d.mkdirs() && !d.isDirectory()) throw new IOException("mkdir failed");
            File[] k = s.listFiles();
            if (k != null) for (File c : k) copyRec(c, new File(d, c.getName()));
        } else {
            try (InputStream in = new FileInputStream(s); OutputStream out = new FileOutputStream(d)) {
                byte[] b = new byte[65536];
                int n;
                while ((n = in.read(b)) > 0) out.write(b, 0, n);
            }
        }
    }

    @PluginMethod
    public void fCopy(PluginCall call) {
        pool.execute(() -> {
            try {
                File t = new File(call.getString("dest"), call.getString("name"));
                if (t.exists()) throw new IOException("already exists");
                copyRec(new File(call.getString("id")), t);
                mediaScan(t.getAbsolutePath());
                call.resolve(pathObj(t));
            } catch (Exception e) { call.reject(String.valueOf(e.getMessage())); }
        });
    }

    @PluginMethod
    public void fMove(PluginCall call) {
        pool.execute(() -> {
            try {
                File f = new File(call.getString("id"));
                File t = new File(call.getString("dest"), f.getName());
                if (t.exists()) throw new IOException("already exists");
                if (!f.renameTo(t)) {
                    copyRec(f, t);
                    if (!delRec(f)) throw new IOException("delete source failed");
                }
                mediaScan(f.getAbsolutePath(), t.getAbsolutePath());
                call.resolve(pathObj(t));
            } catch (Exception e) { call.reject(String.valueOf(e.getMessage())); }
        });
    }

    @PluginMethod
    public void fWrite(PluginCall call) {
        pool.execute(() -> {
            try {
                File t = new File(call.getString("parent"), call.getString("name"));
                try (OutputStream out = new FileOutputStream(t)) {
                    out.write(Base64.decode(call.getString("data", ""), Base64.DEFAULT));
                }
                mediaScan(t.getAbsolutePath());
                call.resolve(pathObj(t));
            } catch (Exception e) { call.reject(String.valueOf(e.getMessage())); }
        });
    }

    private Uri providerUri(String path) {
        return FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", new File(path));
    }

    @PluginMethod
    public void fOpen(PluginCall call) {
        try {
            Intent i = new Intent(Intent.ACTION_VIEW);
            i.setDataAndType(providerUri(call.getString("id")), call.getString("mime", "*/*"));
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(Intent.createChooser(i, null));
            call.resolve();
        } catch (Exception e) { call.reject(String.valueOf(e.getMessage())); }
    }

    @PluginMethod
    public void fShare(PluginCall call) {
        try {
            Intent i = new Intent(Intent.ACTION_SEND);
            i.setType(call.getString("mime", "*/*"));
            i.putExtra(Intent.EXTRA_STREAM, providerUri(call.getString("id")));
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(Intent.createChooser(i, null));
            call.resolve();
        } catch (Exception e) { call.reject(String.valueOf(e.getMessage())); }
    }

    /* ---------------- recent media (MediaStore) ---------------- */
    @PluginMethod
    public void mediaState(PluginCall call) {
        JSObject o = new JSObject();
        o.put("granted", getPermissionState(permAlias()) == PermissionState.GRANTED);
        call.resolve(o);
    }

    @PluginMethod
    public void recent(PluginCall call) {
        if (getPermissionState(permAlias()) != PermissionState.GRANTED) {
            requestPermissionForAlias(permAlias(), call, "recentPerm");
            return;
        }
        loadRecent(call);
    }

    @PermissionCallback
    private void recentPerm(PluginCall call) {
        if (getPermissionState(permAlias()) == PermissionState.GRANTED) {
            loadRecent(call);
        } else {
            JSObject o = new JSObject();
            o.put("items", new JSArray());
            o.put("granted", false);
            call.resolve(o);
        }
    }

    private void loadRecent(PluginCall call) {
        pool.execute(() -> {
            try {
                Uri files = MediaStore.Files.getContentUri("external");
                String[] proj = {
                    MediaStore.Files.FileColumns._ID, MediaStore.Files.FileColumns.DISPLAY_NAME, MediaStore.Files.FileColumns.SIZE,
                    MediaStore.Files.FileColumns.DATE_ADDED, MediaStore.Files.FileColumns.DATE_MODIFIED, MediaStore.Files.FileColumns.MIME_TYPE,
                    Build.VERSION.SDK_INT >= 29 ? MediaStore.MediaColumns.RELATIVE_PATH : MediaStore.Files.FileColumns.DATA
                };
                JSArray arr = new JSArray();
                String sel = MediaStore.Files.FileColumns.MEDIA_TYPE + "!=" + MediaStore.Files.FileColumns.MEDIA_TYPE_NONE
                    + " AND " + MediaStore.Files.FileColumns.SIZE + ">0";
                try (Cursor c = cr().query(files, proj, sel, null, MediaStore.Files.FileColumns.DATE_ADDED + " DESC")) {
                    int n = 0;
                    while (c != null && c.moveToNext() && n < 400) {
                        String name = c.getString(1);
                        if (name == null) continue;
                        String where = c.getString(6) == null ? "" : c.getString(6);
                        if (Build.VERSION.SDK_INT < 29) { int k = where.lastIndexOf('/'); where = k > 0 ? where.substring(0, k) : ""; }
                        JSObject o = new JSObject();
                        o.put("id", ContentUris.withAppendedId(files, c.getLong(0)).toString());
                        o.put("name", name);
                        o.put("dir", false);
                        o.put("size", c.getLong(2));
                        o.put("fs", c.getLong(3) * 1000L);
                        o.put("mod", c.getLong(4) * 1000L);
                        o.put("mime", c.getString(5) == null ? "" : c.getString(5));
                        o.put("where", where);
                        arr.put(o);
                        n++;
                    }
                }
                JSObject res = new JSObject();
                res.put("items", arr);
                res.put("granted", true);
                call.resolve(res);
            } catch (Exception e) { call.reject(String.valueOf(e.getMessage())); }
        });
    }
}
