const {app,BrowserWindow,Tray,Menu, ipcMain,screen} = require("electron")
const path = require('node:path');
const windowStateKeeper = require("electron-window-state")
require("ts-node/register")
const {setVolumeToZero,getAllSessions,SetVolume} = require("./VolumeMixer")
let GetSessionData,GetVolumeData,GetMacroKeybindData,SetSessionData,SetVolumeData,SetMacroKeybindData,DeleteSessionData;
async function loadModules(){
  let module = await import("./electronstore.mjs")
  GetSessionData=module.GetSessionData;
  GetVolumeData=module.GetVolumeData;
  GetMacroKeybindData=module.GetMacroKeybindData;
  SetSessionData=module.SetSessionData;
  SetVolumeData=module.SetVolumeData;
  SetMacroKeybindData=module.SetMacroKeybindData;
  DeleteSessionData=module.DeleteSessionData
}
loadModules().then(()=>{
  //const {GetSessionData,GetVolumeData,GetMacroKeybindData,SetSessionData,SetVolumeData,SetMacroKeybindData} = require("./es6tocommon.mjs")
  // Handle creating/removing shortcuts on Windows when installing/uninstalling.
  let SessionData = GetSessionData();
  let volume;
  console.log("Session data fetched from storage: ",SessionData);
  
  if (require('electron-squirrel-startup')) {
    app.quit();
  }
  let mainWindow;
  let overlayWindow;
  let hideTimeout;
  let KbListener;
  const createWindow = () => {
    // Create the browser window.
    let mainWindowState = windowStateKeeper({
      defaultHeight:600,
      defaultWidth:800
    })
    const mainmenu = Menu.buildFromTemplate([
      {
        label:"File",
        submenu:[
          {label:"Exit",click:()=>{app.exit()}}
        ]
      }
    ])
    mainWindow = new BrowserWindow({
      width: mainWindowState.width,
      height: mainWindowState.height,
      x:mainWindowState.x,
      y:mainWindowState.y,
      icon:path.join(__dirname,"./media/V.ico"),
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
      },
    });
    mainWindow.setMenu(mainmenu)
    mainWindowState.manage(mainWindow);
    if(mainWindowState.isMaximized)mainWindow.maximize();

    // and load the index.html of the app.
    mainWindow.loadFile(path.join(__dirname, './main/index.html'));

    // Open the DevTools.
    //mainWindow.webContents.openDevTools();
    mainWindow.on("close",(e)=>{
      e.preventDefault();
      mainWindowState.saveState()
      mainWindow.hide()
    })
  };

function showOverlay() {
  const {width,height}= screen.getPrimaryDisplay().workAreaSize
  console.log("width, height: ",width,height);
  if(!overlayWindow)
  {
    overlayWindow = new BrowserWindow({
      width: 400,
      height: 75,
      frame: false,
      x:width-400,
      y:height-75,
      resizable:false,
      movable:false,
      skipTaskbar:true,
      focusable:false,
      hasShadow:false,
      transparent: false, // Temporarily disable transparency for debugging
      backgroundColor: '#ffffff', // Add a background color
      alwaysOnTop: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      }
    });
    overlayWindow.setIgnoreMouseEvents(true, { forward: true });
    overlayWindow.loadFile(path.join(__dirname,"./overlay/overlay.html"));
  }else{
    overlayWindow.show();
    clearTimeout(hideTimeout)
    overlayWindow.webContents.executeJavaScript('document.body.classList.remove("fade-out")');
  }
  overlayWindow.send("SendVolumeToRenderer",volume)
  hideTimeout=setTimeout(()=>{
  overlayWindow.webContents.executeJavaScript('document.body.classList.add("fade-out")');
  setTimeout(() => {
      overlayWindow.hide();
    }, 1000);
  }, 1500);
}



  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  app.whenReady().then(() => {
    createWindow();
    let tray = new Tray(path.join(__dirname,"./media/V.ico"));
    const contextMenu = Menu.buildFromTemplate([
      {label:"Open",click:()=>{mainWindow.show()}},
      {label:"Quit",click:()=>{
        KbListener.removeListener(handleKeyboardInput)
        app.exit()
      }}
    ])
    tray.setContextMenu(contextMenu)
    tray.setToolTip("Verchill")
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  // Quit when all windows are closed, except on macOS. There, it's common
  // for applications and their menu bar to stay active until the user quits
  // explicitly with Cmd + Q.
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  //import { GlobalKeyboardListener } from 'node-global-key-listener';
  const {GlobalKeyboardListener} = require("node-global-key-listener")
  KbListener = new GlobalKeyboardListener({windows:{onError:(err)=>{console.error(err)}}});
  handleKeyboardInput = function(e,down){
    if(e.state=="DOWN" && e.name=="MINUS" &&down["LEFT ALT"]&&down["LEFT CTRL"])
    {
      volume=Math.max(-100,volume-5)
      SetVolume(SessionData,volume)
      SetVolumeData(volume)
      mainWindow.send("SendVolumeToRenderer",volume)
      showOverlay()
    }else if(e.state=="DOWN" && e.name=="EQUALS" &&down["LEFT ALT"]&&down["LEFT CTRL"])
    {
      volume=Math.min(100,volume+5)
      SetVolume(SessionData,volume)
      SetVolumeData(volume)
      mainWindow.send("SendVolumeToRenderer",volume)
      showOverlay()
    }
  }
  KbListener.addListener(handleKeyboardInput)
  ipcMain.handle("RefreshSessions",(e)=>{
    let AllSessions = getAllSessions()
    let unknownCount=0
    AllSessions = AllSessions.map(obj=>({
      ...obj,
      name:obj.name===""?`UNKNOWN${unknownCount++}`:obj.name.trim().replace(/\s+/g, '')
    }))
    if(!SessionData){
      SessionData={SideA:[],SideB:[],Ignore:[]}
      AllSessions.forEach(entry=>SessionData.SideA.push(entry.name.trim().replace(/\s+/g, '')||`UNKNOWN${unknownCount++}`))
    }else{
      let flag=true
      AllSessions.forEach(entry=>{
        for(let item2 of SessionData.SideA)
        {
          if (entry.name ===item2) {
            flag=false
            break
          }
        }
        if(flag)
        {
          for(let item2 of SessionData.SideB)
          {
            if (entry.name ===item2) {
              flag=false
              break
            }
          }
        }
        if(flag)
        {
          for(let item2 of SessionData.Ignore)
          {
            if (entry.name ===item2) {
              flag=false
              break
            }
          }
        }
        if(flag) SessionData.SideA.push(entry.name||`UNKNOWN${unknownCount++}`)
      })
    }
    return {AllSessions,SessionData}
  })
  ipcMain.on("SetSession",(e,sessionData)=>{
    SessionData={
      SideA:[...new Set(sessionData.SideA)],
      SideB:[...new Set(sessionData.SideB)],
      Ignore:[...new Set(sessionData.Ignore)]
    }
    console.log("sessiondata: ",SessionData);
    
    SetSessionData(SessionData)
  })
  ipcMain.handle("GetVolumes",(e)=>{
    volume = GetVolumeData()||0
    SetVolume(SessionData,volume)
    return volume
  })
  ipcMain.on("SetVolume",(e,volume)=>{
    volume=volume
    SetVolume(SessionData,volume)
  })
  ipcMain.on("SaveVolume",(e,volume)=>{
    volume=volume
    SetVolume(SessionData,volume)
    SetVolumeData(volume)
  })
  ipcMain.on("DeleteSessionData",()=>{
    DeleteSessionData()
  })
  function DisconnectListeners(){}


  function SetNewMacro(type){}


})




