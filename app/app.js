import net from 'node:net';
import { redisParser, redisResponse } from './redisHandler.js';
import { config } from './config.js';
import { RedisMaster } from './replica.js'

if (config.get('isReplica')) {
     console.log(
          'here for replica',
          config.get('masterHost'),
          config.get('masterPort')
     );
     const replicaRedis = new RedisMaster(
          config.get('masterHost'),
          config.get('masterPort'),
          config.get('port')
     );
     //Connect and recieve ping from replica
    await replicaRedis.connect();
    console.log('Replica established');

     console.log('Sending PING');
     const pingResponse = await replicaRedis.sendPing();
     console.log('PING response:', pingResponse);

     console.log('Sending REPLCONF listening-port');
     const portResponse = await replicaRedis.sendListeningPort();
     console.log('REPLCONF listening-port response:', portResponse);

     console.log('Sending REPLCONF capa psync2');
     const capaResponse = await replicaRedis.sendCapa();
     console.log('REPLCONF capa psync2 response:', capaResponse);

     console.log('Sending psync command');
     const psyncResp = await replicaRedis.sendPsync();
     console.log('Psync response:', psyncResp);
     console.log('Handshake completed');
}

const server = net.createServer((connection) => {
     console.log('client connected');
     connection.on('end', () => {
          console.log('Client disconnected now');
     });
     connection.on('data', (data) => {
          const message = Buffer.from(data).toString().trim();
          const parsedObject = redisParser(message);
          const result = redisResponse(
               parsedObject.command,
               parsedObject.commandArg
          );
          connection.write(result);
          if (parsedObject.command.toLowerCase() === 'psync') {
               const base64 =
                    'UkVESVMwMDEx+glyZWRpcy12ZXIFNy4yLjD6CnJlZGlzLWJpdHPAQPoFY3RpbWXCbQi8ZfoIdXNlZC1tZW3CsMQQAPoIYW9mLWJhc2XAAP/wbjv+wP9aog==';
               const rdbBuffer = Buffer.from(base64, 'base64');
               const rdbHead = Buffer.from(`$${rdbBuffer.length}\r\n`);
              connection.write(Buffer.concat([rdbHead, rdbBuffer]));
              if (!config.get('replicaConnections')) {
                   config.set('replicaConnections', []);
              }
              config.get('replicaConnections').push(connection);
          }
     });
});

server.on('error', (error) => {
     throw error;
});

server.listen(config.get('port'), '127.0.0.1');
