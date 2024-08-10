import SoundMixer, { Device } from "native-sound-mixer";

function removeDuplicates(entries: any[]) {
    const seen = new Set<string>();
    return entries.filter(entry => {
      const key = `${entry.name}-${entry.appName}`;
      if (seen.has(key)) {
        return false; // Duplicate found, filter out
      }
      seen.add(key); // Add key to set
      return true; // Keep entry
    });
}
function calculateVars(value:number):{SideA:number;SideB:number} {
    // Ensure the value is between -100 and 100
    value = Math.max(-100, Math.min(100, value));
    // Calculate VarB: Linearly interpolate between 0 and 100
    //const SideB = Math.min(100,100+value); // Maps -100 to 0 and 100 to 100
    const SideB = Math.min(100, Math.max(0, 100 + value));
    // Calculate VarA: Linearly interpolate between 100 and 0
    const SideA = Math.max(0,Math.min(100,100-value)); // Since VarA and VarB are complementary
    return { SideA, SideB };
}

export function getAllSessions(){
    const devices: Device[] = SoundMixer.devices;
    if (devices.length > 0) {
        const device = devices[0];
        if (device && device.sessions.length > 0) {
            let cleanedResult = removeDuplicates(device.sessions)
            return cleanedResult
        }
    }
}

export function setVolumeToZero() {
    const devices: Device[] = SoundMixer.devices;
    if (devices.length > 0) {
        const device = devices[0];
        if (device && device.sessions.length > 0) {
            device.sessions.map(entry=>{
                entry.volume=0;
            })
        }
    }
}

export function SetVolume(Channel:any,Volume:number){
    const devices: Device[] = SoundMixer.devices;
    if (devices.length > 0) {
        const device = devices[0];
        if (device && device.sessions.length > 0) {
            let {SideA,SideB} = calculateVars(Volume)
            device.sessions.map(entry=>{
                for(let item1 of Channel.SideA)
                {
                    if(item1.trim().replace(/\s+/g, '')===entry.name.trim().replace(/\s+/g, '')){
                        entry.volume = SideA/100;
                        break;
                    }
                }
                for(let item2 of Channel.SideB)
                {
                    if(item2.trim().replace(/\s+/g, '')===entry.name.trim().replace(/\s+/g, '')){
                        entry.volume = SideB/100;
                        break;
                    }
                }
            })
        }
    }
}
