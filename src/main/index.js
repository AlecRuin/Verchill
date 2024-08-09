let mainBody
let SessionData
function DestroyAllSessionVisualizers(){
    document.querySelectorAll(".mainBodyEntry").forEach(entry=>{
        console.log(entry);
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
            let id = `${!entry.name ? `UNKNOWN${unknownCount++}`:entry.name.trim()}`;
            mainBody.insertAdjacentHTML("beforeend",
                `
                <tr class="mainBodyEntry" id=${id}>
                    <td>
                        <button onclick="MoveSession('${id}')">
                        Toggle
                        </button>
                    </td>
                    <td class="SideA">
                    ${result.SessionData.SideA.includes(entry.name)?entry.name.trim():""}
                    </td>
                    <td class="SideB">
                    ${result.SessionData.SideB.includes(entry.name)?entry.name.trim():""}
                    </td>
                    <td class="Ignore">
                    ${result.SessionData.Ignore.includes(entry.name)?entry.name.trim():""}
                    </td>
                </tr>
                `
            )
        })  
    })
}

document.addEventListener("DOMContentLoaded",()=>{
    mainBody = document.querySelector(".mainBody")
    RefreshSessions()
    //Ask for volume
    const slider = document.getElementById('volume-slider');
    window.electronAPI.GetVolumes().then(result=>{
        console.log("Volume: ",result);
        slider.value=result
    })
    slider.addEventListener('input', () => {
        //set volume
        window.electronAPI.SetVolume(slider.value)
    });
    slider.addEventListener("mouseup",()=>{
        //save volume
        window.electronAPI.SaveVolume(slider.value)
    })
    window.electronAPI.SignalToRenderer("SendVolumeToRenderer",(volume)=>{
        slider.value=volume
    })
})