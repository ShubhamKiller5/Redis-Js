import net from 'node:net';
import { redisParser, redisResponse } from './redisHandler.js';
import { config } from './config.js';
import { RedisMaster } from './replica.js';

if (config.get('isReplica')) {
     console.log(
          'here for replica',
          config.get('masterHost'),
          config.get('masterPort')
     );
     const masterRedis = new RedisMaster(
          config.get('masterHost'),
          config.get('masterPort'),
          config.get('port')
     );
     //Connect and recieve ping from replica
     await masterRedis.connect();

     console.log('Sending PING');
     const pingResponse = await masterRedis.sendPing();
     console.log('PING response:', pingResponse);

     console.log('Sending REPLCONF listening-port');
     const portResponse = await masterRedis.sendListeningPort();
     console.log('REPLCONF listening-port response:', portResponse);

     console.log('Sending REPLCONF capa psync2');
     const capaResponse = await masterRedis.sendCapa();
     console.log('REPLCONF capa psync2 response:', capaResponse);

     console.log('Sending psync command');
     const psyncResp = await masterRedis.sendPsync();
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
     });
});

server.on('error', (error) => {
     throw error;
});

server.listen(config.get('port'), '127.0.0.1');
