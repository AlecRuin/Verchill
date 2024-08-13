let mainBody,SessionData,SideAButton,SideBButton,CurrentMacroLabel,Popup,SaveMacroBtn,side
function DestroyAllSessionVisualizers(){
    document.querySelectorAll(".mainBodyEntry").forEach(entry=>{
        if (entry.id!="Label")entry.remove()
    })
}

function MoveSession(id){
    console.log(id);
    ;let tablerow = document.getElementById(id)
    let SideA = tablerow.querySelector(".SideA")
    let SideB = tablerow.querySelector(".SideB")
    let Ignore = tablerow.querySelector(".Ignore")
    if (SideA.innerHTML!="")
    {
        //element is in side A, move to Side B
        console.log("element is in side A, move to Side B");
        SessionData.SideA=SessionData.SideA.filter(item=>item!==id)
        SessionData.SideB.push(id)
        SideB.innerHTML=SideA.innerHTML
        //set msg to server
        SideA.innerHTML=""

    }else if(SideB.innerHTML!=""){
        //element is in side B, move to Ignore
        console.log("element is in side B, move to Ignore");
        SessionData.SideB=SessionData.SideB.filter(item=>item!==id)
        SessionData.Ignore.push(id)
        Ignore.innerHTML=SideB.innerHTML
        SideB.innerHTML=""
    }else{
        //element is in ignore, move to side a
        console.log("element is in ignore, move to side a");
        SessionData.Ignore=SessionData.Ignore.filter(item=>item!==id)
        SessionData.SideA.push(id)
        SideA.innerHTML=Ignore.innerHTML
        Ignore.innerHTML=""
    }
    console.log("SessionData: ",SessionData);
    //TODO: save to server
    window.electronAPI.SetSession(SessionData)
}

function RefreshSessions(){
    DestroyAllSessionVisualizers()
    let unknownCount=0;
    window.electronAPI.RefreshSessions().then(result=>{
        console.log(result);
        SessionData=result.SessionData
        result.AllSessions.forEach(entry=>{
            let id = `${!entry.name ? `UNKNOWN${unknownCount++}`:entry.name.trim().replace(/\s+/g, '')}`;
            mainBody.insertAdjacentHTML("beforeend",
                `
                <tr class="mainBodyEntry" id=${id}>
                    <td>
                        <button onclick="MoveSession('${id}')">
                        Toggle
                        </button>
                    </td>
                    <td class="SideA">
                    ${result.SessionData.SideA.includes(entry.name)?entry.name.trim().replace(/\s+/g, ''):""}
                    </td>
                    <td class="SideB">
                    ${result.SessionData.SideB.includes(entry.name)?entry.name.trim().replace(/\s+/g, ''):""}
                    </td>
                    <td class="Ignore">
                    ${result.SessionData.Ignore.includes(entry.name)?entry.name.trim().replace(/\s+/g, ''):""}
                    </td>
                </tr>
                `
            )
        })  
    })
}

document.addEventListener("DOMContentLoaded",()=>{
    mainBody = document.querySelector(".mainBody")
    SideAButton=document.getElementById('SideA')
    SideBButton=document.getElementById("SideB")
    Popup=document.getElementById('popup')
    SaveMacroBtn=document.getElementById("SaveMacroBtn")
    CurrentMacroLabel=document.getElementById("CurrentMacro")
    RefreshSessions()
    //Ask for volume
    const slider = document.getElementById('volume-slider');
    const sliderLabel = document.getElementById("volume-label")
    window.electronAPI.GetVolumes().then(result=>{
        console.log("Volume: ",result);
        slider.value=result
        sliderLabel.innerHTML=result
    })
    slider.addEventListener('input', () => {
        //set volume
        slider.value = Math.floor(Math.round(slider.value/5)*5);
        sliderLabel.innerHTML=slider.value
        window.electronAPI.SetVolume(slider.value)
    });
    slider.addEventListener("mouseup",()=>{
        //save volume
        window.electronAPI.SaveVolume(slider.value)
    })

    SideAButton.addEventListener('click', () => BeginRecordingMacro("SideA"));
    SideBButton.addEventListener('click', () => BeginRecordingMacro("SideB"));

    window.electronAPI.GetKeyboardMacro().then(result=>{
        SideAButton.innerHTML=`${result["SideA"].join(" + ")}`
        SideBButton.innerHTML=`${result["SideB"].join(" + ")}`
    })

    document.getElementById('closePopup').addEventListener('click', () => {
        //TODO: Disconnect listener, reconnect old one
        window.electronAPI.AbortKeyboardMacroRecord()
        Popup.classList.add('hidden');
    });

    SaveMacroBtn.addEventListener("click",()=>{
        window.electronAPI.SaveKeyboardMacroRecord(side).then(result=>{
            (side==="SideA")?SideAButton.innerHTML=`${result.join(" + ")}`:SideBButton.innerHTML=`${result.join(" + ")}`
        })
        Popup.classList.add('hidden');
    })

    window.electronAPI.SignalToRenderer("SendVolumeToRenderer",(volume)=>{
        sliderLabel.innerHTML=volume
        slider.value=volume
    })

    
})
function ResetSavedData()
{
    window.electronAPI.SaveVolume(0)
    window.electronAPI.DeleteSessionData()
}
function BeginRecordingMacro(Side)
{
    side=Side
    Popup.classList.remove('hidden');
    CurrentMacroLabel.innerHTML=""
    //Get Current Macro for the given side
    window.electronAPI.GetKeyboardMacro().then(result=>{
        //display it
        CurrentMacroLabel.innerHTML=`${result[Side].join(" + ")}`
    })
    //then begin recording macro
    window.electronAPI.BeginKeyboardMacroRecord(Side)
}

window.electronAPI.SignalToRenderer("SendMacroBufferToRenderer",(MacroBuffer)=>{
    console.log("MacroBuffer: ",MacroBuffer);
    
    console.log(typeof MacroBuffer);
    
    CurrentMacroLabel.innerHTML=`${MacroBuffer.join(" + ")}`
})

setInterval(() => {
    RefreshSessions()
}, 2000);