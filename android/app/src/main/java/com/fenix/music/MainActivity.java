package com.fenix.music;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.view.Window;

public class MainActivity extends Activity {
    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;
    private static final int FILE_PICKER = 1001;
    private static final String START_URL = "https://ccmusice.onrender.com";

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        webView = new WebView(this);
        setContentView(webView);
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true); s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false); s.setAllowFileAccess(true); s.setAllowContentAccess(true);
        s.setSupportZoom(false); s.setBuiltInZoomControls(false); s.setDisplayZoomControls(false);
        webView.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req){
                Uri u=req.getUrl();
                if (u.getScheme().equals("http") || u.getScheme().equals("https")) { view.loadUrl(u.toString()); return true; }
                try { startActivity(new Intent(Intent.ACTION_VIEW,u)); } catch(Exception ignored){}
                return true;
            }
        });
        webView.setWebChromeClient(new WebChromeClient(){
            @Override public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams params){
                if(fileCallback!=null) fileCallback.onReceiveValue(null); fileCallback=cb;
                try { startActivityForResult(params.createIntent(),FILE_PICKER); } catch(Exception e){ fileCallback=null; return false; }
                return true;
            }
        });
        if(savedInstanceState!=null) webView.restoreState(savedInstanceState); else webView.loadUrl(START_URL);
    }
    @Override protected void onActivityResult(int requestCode,int resultCode,Intent data){
        super.onActivityResult(requestCode,resultCode,data);
        if(requestCode==FILE_PICKER && fileCallback!=null){ Uri[] r=null; if(resultCode==RESULT_OK && data!=null){Uri u=data.getData(); if(u!=null)r=new Uri[]{u};} fileCallback.onReceiveValue(r); fileCallback=null; }
    }
    @Override protected void onSaveInstanceState(Bundle out){ webView.saveState(out); super.onSaveInstanceState(out); }
    @Override public void onBackPressed(){ if(webView.canGoBack()) webView.goBack(); else super.onBackPressed(); }
}
