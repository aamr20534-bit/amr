package com.amr.filemanager;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AmrFSPlugin.class); // real file-system access (Storage Access Framework + MediaStore)
        super.onCreate(savedInstanceState);
    }
}
