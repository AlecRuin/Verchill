document.addEventListener("DOMContentLoaded",()=>{
    const slider = document.getElementById("volume-slider")
    const label = document.getElementById("input-label")
    window.electronAPI.SignalToRenderer("SendVolumeToRenderer",(volume)=>{
        slider.value=volume
        label.innerHTML=volume
    })
})