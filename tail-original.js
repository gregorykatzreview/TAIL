const fs = require('fs')
let files = []
let watcher = undefined
let output = ''
let path

exports.search = function(file) {
  let temp = file.split('\\')
  path = temp.slice(0, temp.length - 1).join('\\') || '.'

  fs.stat(file, (error, stat) => {
    if(error) {
    if(error.code === 'ENOENT') {
      console.log(`file does not exist`)
      //TODO REJECT HERE
    }
    } else {
    files.push({
      ino: stat.ino,
      size: stat.size,
      file: file,
      rename: false
    })

    let tail = new Tail()

    let rename = false
    watcher = fs.watch(file, event => {
      if(event == 'rename') {
      rename = true
      } else {
      if(rename) {
        rename = false

        files[files.length - 1].rename = true
        
        fs.stat(file, (error, stat) => {
          files.push({
            ino: stat.ino,
            size: stat.size,
            file: file,
            rename: false
          })
        })
      }
      
      tail.read()
      }
    })
    
    }
  })

}

class Tail {
  constructor() {
    this.fileDescriptor = undefined
    this.ready = false
    this.init()
  }

  init() {
    fs.open(files[0].file, 'r', (status, fileDescriptor) => {
      this.fileDescriptor = fileDescriptor
      this.ready = true
      this.queue()
    })
  }

  queue() {
    if(this.ready) {
      this.ready = false
      
      if(files[0].rename) {
        findName(files[0].ino, path, file => {
          files[0].file = file
          this.read()
        })
      } else {
        console.log(`same file, reading`)
        this.read()
      }
    }
  }
  
  read() {
    fs.stat(files[0].file, (error, stat) => {
      if(error) {
        if(error.code === 'ENOENT') {
          console.log(`file does not exist - while trying to read the file: ${files[0].file}`)
          return
        }
      } else {
        if(stat.size == files[0].size) {
          if(files.length > 1) {
            fs.close(this.fileDescriptor, error => {
              if(error) {
                console.log(`unable to close file ${files[0].file}`)
              }
              
              files.shift()
              files[0].size = 0
              
              this.init()
            })
          } else {
            this.running = false
          }
        } else {
          if(this.fileDescriptor) {
            if(stat.size < files[0].size) {
              files[0].size = 0
            }
            
            let byteSize = stat.size - files[0].size

            let data = Buffer.alloc(byteSize)
            fs.read(this.fileDescriptor, data, 0, byteSize, files[0].size, (error, bytesRead, buffer) => {
              process.stdout.write(data.toString('utf8'))

              files[0].size = stat.size
              
              this.ready = true
              this.queue()
            })
            
          } else {
            this.init()
          }
        }
      }
    })
  }

}

function findName(ino, path, callback) {
  fs.readdirSync(path).forEach(file => {
    fs.stat(`${path}\\${file}`, (error, stat) => {
      if(error) {
        //error.code
      } else {
        if(stat.isFile()) {
          if(stat.ino == ino) {
            callback(`${path}\\${file}`)
          } 
        }
      }
    })
  })
}
