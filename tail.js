const fs = require('fs')

exports.search = function(regex, timeout, fileName) {
	return new Promise((resolve, reject) => {
		let links = []
		let index = 0
		let output = ''
		let watcher = undefined
		let timer = undefined

		class Tail {
		  constructor() {
			this.running = true
			this.fileDescriptor = undefined
			this.init()
		  }
		  
		  init() {
			fs.open(links[0].name, 'r', (status, fileDescriptor) => {
			  this.fileDescriptor = fileDescriptor
			  this.run()
			})
		  }
		  
		  run() {
			let size = fs.statSync(links[0].name).size
			
			if(links[0].size == size) {
			  if(links.length > 1) {
				fs.close(this.fileDescriptor, error => {
				  if(error) {
					console.log(`unable to close file ${links[0].name}`)
				  }
				  
				  fs.unlink(links[0].name, error => {
					if(error) {
					  console.log(`unlink failure: ${error}`)
					}
					links.shift()
					links[0].size = 0
					
					this.init()
				  })
				})
			  } else {
				this.running = false
			  }
			} else {
			  if(this.fileDescriptor) {
				if(size < links[0].size) {
				  links[0].size = 0
				}
				
				let byteSize = size - links[0].size
			  
				let data = Buffer.alloc(byteSize)
				fs.read(this.fileDescriptor, data, 0, byteSize, links[0].size, (error, bytesRead, buffer) => {
				  output += data.toString('utf8')
				  let match = output.match(regex)
				  if(match) {
					  clearInterval(timer)
					  watcher.close()
					  resolve(match)
				  }
				  links[0].size = size
				  this.run()
				})
			  } else {
				this.init()
			  }
			}
		  }
		  
		  queue() {
			if(!this.running) {
			  this.running = true
			  this.run()
			}
		  }
		}

		clean().then( _ => {
		  if(fs.existsSync(fileName)) {
			fs.link(fileName, `_tmp${index}`, error => {
			  let size = fs.statSync(`_tmp${index}`).size
			  links.push({name: `_tmp${index}`, size: size})
			  index++
			  
			  let tail = new Tail()
			  
			  let rename = false
			  watcher = fs.watch(fileName, eventType => {
				if(eventType == 'rename') {
				  rename = true
				} else {
				  if(rename) {
					rename = false
					fs.link(fileName, `_tmp${index}`, error => {
					  size = fs.statSync(`_tmp${index}`).size
					  links.push({name: `_tmp${index}`, size: size})
					  index++
					})
				  }
				  tail.queue()
				}
			  })
			})
		  } else {
			reject(`file ${fileName} doesn't exist`)
		  }
		})

		if(timeout) {
			timer = setTimeout(function() {
				watcher.close()
				reject(`search timed out`)
			}, timeout * 1000)			
		}
	})
}

function clean() {
  return new Promise(resolve => {
    let files = fs.readdirSync(`.`).filter(file => file.match(/^_tmp/))

    let promises = []
    files.forEach(file => {
      promises.push(removeFile(file))
    })
    Promise.all(promises).then( _ => {
      resolve()
    })
  })
}

function removeFile(file) {
  return new Promise(resolve => {
    fs.unlink(file, error => {
      if(error) {
        console.log(`error removing ${file}`)
      }
      resolve()
    })
  }) 
}
