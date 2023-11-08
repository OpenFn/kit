let start = process.hrtime.bigint()
setInterval(() => {
  console.log(process.hrtime.bigint() - start)

})