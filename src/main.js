const {app,BrowserWindow,Tray,Menu, ipcMain,screen} = require("electron")
const path = require('node:path');
const {ClearFile,Log} = require("./logging.js")
const windowStateKeeper = require("electron-window-state")
require("ts-node/register")
const {getAllSessions,SetVolume} = require("./VolumeMixer")

//#region Module
let GetSessionData,GetVolumeData,GetMacroKeybindData,SetSessionData,SetVolumeData,SetMacroKeybindData,DeleteSessionData,GetLoggingState,SetLoggingState,DeleteAllData;
async function loadModules(){
  let module = await import("./electronstore.mjs")
  GetSessionData=module.GetSessionData;
  GetVolumeData=module.GetVolumeData;
  GetMacroKeybindData=module.GetMacroKeybindData;
  SetSessionData=module.SetSessionData;
  SetVolumeData=module.SetVolumeData;
  SetMacroKeybindData=module.SetMacroKeybindData;
  DeleteSessionData=module.DeleteSessionData
  GetLoggingState=module.GetLoggingState
  SetLoggingState=module.SetLoggingState
  DeleteAllData=module.DeleteAllData
}
//#endregion

loadModules().then(()=>{
  //const {GetSessionData,GetVolumeData,GetMacroKeybindData,SetSessionData,SetVolumeData,SetMacroKeybindData} = require("./es6tocommon.mjs")
  // Handle creating/removing shortcuts on Windows when installing/uninstalling.
  if (require('electron-squirrel-startup')) {
    app.quit();
  }

  ClearFile()
  DeleteAllData()
  let SessionData = GetSessionData();
  let bIsVerboseLogging = GetLoggingState()||true;
  let KeyboardMacros = GetMacroKeybindData()||{
    SideA:["LEFT CTRL","LEFT ALT","MINUS"],
    SideB:["LEFT CTRL","LEFT ALT","EQUALS"]
  }
  let KeyboardMacrosBuffer,Side;
  let KeyBlacklist = [
    "MOUSE LEFT",
    "MOUSE RIGHT",
    "MOUSE MIDDLE",
    "LEFT META",
    "RIGHT META",
    "ESCAPE",
    ""
  ]
  let volume,mainWindow,overlayWindow,hideTimeout,KbListener;
  if(bIsVerboseLogging)Log("Session data fetched from storage: ",SessionData);
  if(bIsVerboseLogging)Log("Logging state: ",bIsVerboseLogging);

  //#region Main Window logic
  const createWindow = () => {
    // Create the browser window.
    const {width,height}= screen.getPrimaryDisplay().workAreaSize
    if(bIsVerboseLogging)Log("Current window Width and Height: ",width,height);
    if(bIsVerboseLogging)Log("Setting default main window dimensions to (X,Y): ",Math.floor(width*0.4),Math.floor(height*0.4));
    let mainWindowState = windowStateKeeper({
      defaultHeight:Math.floor(height*0.4),
      defaultWidth:Math.floor(width*0.4)
    })
    const mainmenu = Menu.buildFromTemplate([
      {
        label:"File",
        submenu:[
          {label:"Exit",click:()=>{
            if(bIsVerboseLogging)Log("Saving window state manually...");
            mainWindowState.saveState()
            if(bIsVerboseLogging)Log("Closing app");
            app.exit()
          }},
          {label:"Toggle verbose logging",click:()=>{
            bIsVerboseLogging=!bIsVerboseLogging;
            SetLoggingState(bIsVerboseLogging);
            if(bIsVerboseLogging)Log("Verbose logging toggled. Logging state: ",bIsVerboseLogging);
          }}
        ]
      }
    ])
    mainWindow = new BrowserWindow({
      width: mainWindowState.width,
      height: mainWindowState.height,
      x:mainWindowState.x,
      y:mainWindowState.y,
      icon:path.join(__dirname,"./media/nowiwin.ico"),
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
      },
    });
    if(bIsVerboseLogging)Log("Setting mainWindow mainMenu");
    mainWindow.setMenu(mainmenu)
    if(bIsVerboseLogging)Log("Handing mainWindow over to window-state-keeper to save user preferences");
    mainWindowState.manage(mainWindow);
    if(bIsVerboseLogging)Log("Was mainWindow maximized last in use? ",mainWindowState.isMaximized);
    if(mainWindowState.isMaximized)mainWindow.maximize();
    // and load the index.html of the app.
    if(bIsVerboseLogging)Log("Loading HTML file from ",path.join(__dirname,"./main/index.html"));
    mainWindow.loadFile(path.join(__dirname, './main/index.html'));
    // Open the DevTools.
    mainWindow.webContents.openDevTools();
    mainWindow.on("close",(e)=>{
      e.preventDefault();
      if(bIsVerboseLogging)Log("Saving window state manually...");
      mainWindowState.saveState()
      if(bIsVerboseLogging)Log("Hiding mainWindow from display");
      mainWindow.hide()
    })
  };
  //#endregion

  //#region Overlay logic
  function showOverlay() {
    if(!overlayWindow)
    {
      const {width,height}= screen.getPrimaryDisplay().workAreaSize
      if(bIsVerboseLogging)Log("Current window Width and Height: ",width,height);
      if(bIsVerboseLogging)Log("Setting default overlay window dimensions to (X,Y): ",Math.floor(width*0.15),Math.floor(height*0.05));
      overlayWindow = new BrowserWindow({
        width: Math.floor(width*0.15),
        height: Math.floor(height*0.05),
        frame: false,
        x:width-Math.floor(width*0.15),
        y:height-Math.floor(height*0.05),
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
      if(bIsVerboseLogging)Log("Setting overlay to ignore mouse");
      overlayWindow.setIgnoreMouseEvents(true, { forward: true });
      if(bIsVerboseLogging)Log("Loading HTML file from ",path.join(__dirname,"./overlay/overlay.html"));
      overlayWindow.loadFile(path.join(__dirname,"./overlay/overlay.html"));
    }else{
      if(bIsVerboseLogging)Log("Overlay window already exists. Showing overlay window");
      overlayWindow.show();
      if(bIsVerboseLogging)Log("Resetting timer");
      clearTimeout(hideTimeout)
      if(bIsVerboseLogging)Log("Removing fadeout");
      overlayWindow.webContents.executeJavaScript('document.body.classList.remove("fade-out")');
    }
    if(bIsVerboseLogging)Log("Sending current volume level to renderer: ",volume);
    overlayWindow.send("SendVolumeToRenderer",volume)
    if(bIsVerboseLogging)Log("Beginning timer");
    hideTimeout=setTimeout(()=>{
    if(bIsVerboseLogging)Log("Starting fade away");
    overlayWindow.webContents.executeJavaScript('document.body.classList.add("fade-out")');
    setTimeout(() => {
        if(bIsVerboseLogging)Log("Hiding overlay window");
        overlayWindow.hide();
      }, 1000);
    }, 1500);
  }
  //#endregion

  //#region App WhenReady/Window-All-closed
  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  app.whenReady().then(() => {
    if(bIsVerboseLogging)Log("Creating mainWindow");
    createWindow();
    if(bIsVerboseLogging)Log("Creating tray");
    let tray = new Tray(path.join(__dirname,"./media/V.ico"));
    const contextMenu = Menu.buildFromTemplate([
      {label:"Open",click:()=>{mainWindow.show()}},
      {label:"Quit",click:()=>{
        KbListener.removeListener(HandleKeyboardInput)
        app.exit()
      }}
    ])
    tray.setContextMenu(contextMenu)
    tray.setToolTip("Verchill Audio Mixer")
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
  //#endregion
  
  //#region Handle keyboard macros
  const {GlobalKeyboardListener} = require("node-global-key-listener")
  KbListener = new GlobalKeyboardListener({windows:{onError:(err)=>{console.error(err)}}});
  HandleKeyboardInput=function(e,down){
    if(KeyboardMacros.SideA.every(key=>down[key]))
    {
      if(bIsVerboseLogging)Log("Favoring Side A");
      volume=Math.max(-100,volume-5)
      if(bIsVerboseLogging)Log("Volume: ",volume);
      SetVolume(SessionData,volume)
      SetVolumeData(volume)
      if(bIsVerboseLogging)Log("Sending volume value back to renderer");
      mainWindow.send("SendVolumeToRenderer",volume)
      if(bIsVerboseLogging)Log("Showing overlay window");
      showOverlay()
    }
    if(KeyboardMacros.SideB.every(key=>down[key])){
      if(bIsVerboseLogging)Log("Favoring Side B");
      volume=Math.min(100,volume+5)
      if(bIsVerboseLogging)Log("Volume: ",volume);
      SetVolume(SessionData,volume)
      SetVolumeData(volume)
      if(bIsVerboseLogging)Log("Sending volume value back to renderer");
      mainWindow.send("SendVolumeToRenderer",volume)
      if(bIsVerboseLogging)Log("Showing overlay window");
      showOverlay()
    }
  }

  KbListener.addListener(HandleKeyboardInput);

  RecordKeyboardMacro = function(e,down){
    if(!KeyBlacklist.includes(e.name)&&e.state==="DOWN"&&!KeyboardMacrosBuffer[Side].includes(e.name))
    {
      if(bIsVerboseLogging)Log("Keyboard input detected: ",e.name);
      if(bIsVerboseLogging)Log("KeyboardMacrosBuffer: ",KeyboardMacrosBuffer);
      if(bIsVerboseLogging)Log("Side: ",Side);
      if (KeyboardMacrosBuffer[Side].length<3){
        KeyboardMacrosBuffer[Side].push(e.name)
      }else{
        KeyboardMacrosBuffer[Side][2]=e.name
      }
      if(bIsVerboseLogging)Log("KeyboardMacrosBuffer: ",KeyboardMacrosBuffer);
      mainWindow.send("SendMacroBufferToRenderer",KeyboardMacrosBuffer[Side])
    }
  }

  ipcMain.on("BeginKeyboardMacroRecord",(e,side)=>{
    KbListener.removeListener(HandleKeyboardInput)
    Side=side;
    KeyboardMacrosBuffer={
      SideA:[],
      SideB:[]
    }
    KbListener.addListener(RecordKeyboardMacro);
  })

  ipcMain.handle("SaveKeyboardMacroRecord",(e,side)=>{
    KbListener.removeListener(RecordKeyboardMacro)
    KeyboardMacros[side]=KeyboardMacrosBuffer[side]
    SetMacroKeybindData(KeyboardMacros)
    KbListener.addListener(HandleKeyboardInput)
    return KeyboardMacros[side]
  })

  ipcMain.on("AbortKeyboardMacroRecord",()=>{
    KbListener.removeListener(RecordKeyboardMacro)
    KeyboardMacrosBuffer={
      SideA:[],
      SideB:[]
    }
    Side=undefined;
    KbListener.addListener(HandleKeyboardInput)
  })

  ipcMain.handle("GetKeyboardMacro",()=>{
    return KeyboardMacros
  })
  //#endregion

  //#region Sessions
  ipcMain.handle("RefreshSessions",(e)=>{
    if(bIsVerboseLogging)Log("RefreshSessions called. Getting all audio sessions");
    let AllSessions = getAllSessions()
    if(bIsVerboseLogging)Log("Audio Sessions: ",AllSessions);
    let unknownCount=0
    AllSessions = AllSessions.map(obj=>({
      ...obj,
      name:obj.name===""?`UNKNOWN${unknownCount++}`:obj.name.trim().replace(/\s+/g, '')
    }))
    if(!SessionData){
      SessionData={SideA:[],SideB:[],Ignore:[]}
      AllSessions.forEach(entry=>SessionData.SideA.push(entry.name.trim().replace(/\s+/g, '')||`UNKNOWN${unknownCount++}`))
    }else{
      AllSessions.forEach(entry=>{
        let flag=true
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
            console.log("item3: ",item2);
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
    if(bIsVerboseLogging)Log("SetSession called with this data: ",sessionData);
    SessionData={
      SideA:[...new Set(sessionData.SideA)],
      SideB:[...new Set(sessionData.SideB)],
      Ignore:[...new Set(sessionData.Ignore)]
    }
    if(bIsVerboseLogging)Log("SessionData is now this: ",SessionData);
    SetSessionData(SessionData)
  })
  
  ipcMain.on("DeleteSessionData",()=>{
      DeleteSessionData()
  })

  //#endregion
  
  //#region Volume
  ipcMain.handle("GetVolumes",(e)=>{
    if(bIsVerboseLogging)Log("GetVolumes called");
    volume = GetVolumeData()||0
    if(bIsVerboseLogging)Log("Setting volume to: ",volume);
    SetVolume(SessionData,volume)
    return volume
  })
  ipcMain.on("SetVolume",(e,volume)=>{
    if(bIsVerboseLogging)Log("SetVolume called with: ",volume);
    volume=volume
    if(bIsVerboseLogging)Log("Setting volume to: ",volume);
    SetVolume(SessionData,volume)
  })
  ipcMain.on("SaveVolume",(e,volume)=>{
    if(bIsVerboseLogging)Log("SaveVolume called with: ",volume);
    volume=volume
    if(bIsVerboseLogging)Log("Setting volume to: ",volume);
    SetVolume(SessionData,volume)
    SetVolumeData(volume)
  })
  //#endregion

})




