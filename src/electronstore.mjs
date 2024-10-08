import Store from "electron-store"

const store = new Store();

//store.set('unicorn', '🦄');
//store.set('foo.bar', true);
//store.delete('unicorn');

export function GetSessionData()
{
    return store.get("SessionData")
}
export function SetSessionData(data){
    console.log("setting sessiondata: ",data);
    store.set("SessionData",data)
}
export function GetVolumeData()
{
    return store.get("VolumeData")
}
export function SetVolumeData(data)
{
    store.set("VolumeData",data) 
}
export function GetMacroKeybindData()
{
    return store.get("Keybinds")
}
export function SetMacroKeybindData(data)
{
    store.set("Keybinds",data)
}
export function DeleteSessionData()
{
    store.delete("SessionData")
}
export function GetLoggingState()
{
    return store.get("LoggingState")
}
export function SetLoggingState(data)
{
    store.set("LoggingState",data)
}
export function DeleteAllData()
{
    store.delete("SessionData")
    store.delete("LoggingState")
    store.delete("Keybinds")
    store.delete("VolumeData")
}