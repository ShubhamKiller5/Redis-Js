export const config = new Map();
const [file, dbFileName] = [process.argv[3] ?? null, process.argv[5] ?? null];
let port = process.argv[2] == '--port' ? parseInt(process.argv[3]) : 6379;
config.set('port', port);
if (file || dbFileName) {
     config.set('dir', file);
     config.set('dbfilename', dbFileName);
}

export const map = {};
