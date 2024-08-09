// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
const {contextBridge,ipcRenderer} = require("electron/renderer")
contextBridge.exposeInMainWorld("electronAPI",{
    RefreshSessions:()=>{return ipcRenderer.invoke("RefreshSessions")},
    GetVolumes:()=>{return ipcRenderer.invoke("GetVolumes")},

    SetSession:(SessionData)=>{ipcRenderer.send("SetSession",SessionData)},
    ToggleMacroChangeMode:()=>{ipcRenderer.send("ToggleMacroChangeMode")},
    SetMacro:()=>{ipcRenderer.send("ToggleMacroChangeMode")},
    SetVolume:(Volume)=>{ipcRenderer.send("SetVolume",Volume)},
    SaveVolume:(volume)=>{ipcRenderer.send("SaveVolume",volume)},
    DeleteSessionData:()=>{ipcRenderer.send("DeleteSessionData")},

    SignalToRenderer:async(channel,callback)=>{ipcRenderer.on(channel,(e,...args)=>{callback(...args)})}
})