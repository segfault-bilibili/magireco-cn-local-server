// get string representation in javascript string
export const getStrRep = (text: string) => Buffer.from(`${text}`, 'utf16le').swap16().toString('hex')
.replace(/([\da-f]{4})/g, "\\u$1").replace(/\\u00/g, "\\x")