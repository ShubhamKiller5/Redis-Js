export const config = new Map();
const [file, dbFileName] = [process.argv[3] ?? null, process.argv[5] ?? null];
const port = process.argv[2] == '--port' ? parseInt(process.argv[3]) : 6379;
const isReplica = process.argv[4] == '--replicaof' ? true : false;
if (isReplica) {
     config.set('isReplica', isReplica);
}
config.set('port', port);
if (file || dbFileName) {
     config.set('dir', file);
     config.set('dbfilename', dbFileName);
}

export const map = {};
