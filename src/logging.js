const fs= require("fs")
const path = require("path")
const os = require("os")
let logStream,Dir
function SetDir(dir)
{
    Dir=dir
    logStream = fs.createWriteStream(path.join(dir,"./log.txt"),{flags:"a"})
}
function ClearFile()
{
    fs.writeFileSync(path.join(Dir,"./log.txt"),"")
}
function Log(...msg)
{
    console.log(...msg); 
    const finalizedString = msg.map(arg => typeof arg === 'object' ? JSON.stringify(arg,null," ") : (arg==undefined)?arg:arg.toString()).join(' ');
    let now = new Date()
    let formatDate = `[${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}.${String(now.getMinutes()).padStart(2, '0')}.${String(now.getSeconds()).padStart(2, '0')}:${String(now.getMilliseconds()).padStart(3, '0')}]`
    logStream.write(`\n${formatDate}: `+finalizedString)
}
module.exports={ClearFile,Log,SetDir}