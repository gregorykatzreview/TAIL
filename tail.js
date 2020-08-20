const fs = require('fs')
let files = []
let watcher = undefined
let output = ''
let path
let verbose = false
let regex

exports.search = function(rgx, timeout, file, consoleOutput) {
	regex = rgx
	verbose = consoleOutput | false
	
	return new Promise((resolve, reject) => {
		let temp = file.split('\\')
		path = temp.slice(0, temp.length - 1).join('\\') || '.'


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
						this.read()
					}
				}
			}
			
			read() {
				fs.stat(files[0].file, (error, stat) => {
					if(error) {
						if(error.code === 'ENOENT') {
						  reject(`file does not exist ${files[0].file}`)
						} else {
						  reject(`error while reading file(${files[0].file}): ${error.code}`)
						}
					} else {
						if(stat.size == files[0].size) {
							if(files.length > 1) {
								fs.close(this.fileDescriptor, error => {
									if(error) {
										reject(`unable to close file ${files[0].file}`)
									}
									
									files.shift()
									files[0].size = 0
									
									this.init()
								})
							} else {
								this.ready = true
							}
						} else {
							if(this.fileDescriptor) {
								if(stat.size < files[0].size) {
									files[0].size = 0
								}
								
								let byteSize = stat.size - files[0].size

								let data = Buffer.alloc(byteSize)
								fs.read(this.fileDescriptor, data, 0, byteSize, files[0].size, (error, bytesRead, buffer) => {
									if(verbose) {
										process.stdout.write(data.toString('utf8'))
									}
									
									output += data.toString('utf8')
									files[0].size = stat.size
									
									this.match()
									
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
			
			match() {
				let match = output.match(regex)
				if(match) {
					clearInterval(timer)
					watcher.close()
					resolve(match)
				}
			}

		}


		fs.stat(file, (error, stat) => {
		  if(error) {
			if(error.code === 'ENOENT') {
			  reject(`file does not exist`)
			} else {
			  reject(`error: ${error.code}`)
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
						  size: 0,
						  file: file,
						  rename: false
						})
					})
				}
				

				tail.queue()
			  }
			})
			
		  }
		})


		if(timeout) {
			timer = setTimeout(function() {
				watcher.close()
				reject(`timeout`)
			}, timeout * 1000)
		}
	})
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
