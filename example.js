const tail = require('./tail.js')

const rgx = new RegExp(/^(5)$/, 'im')


tail.search(rgx, 6, 'application.log').then(success => {
  console.log(success)
}, failure => {
  console.log(`failure: ${failure}`)
})
