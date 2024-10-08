import { redisParser, redisResponse } from './redisHandler.js';
import net from 'node:net';

export class RedisReplica {
     constructor(masterHost,masterPort) {
          this.host = masterHost
          this.port = masterPort
          this.connection = null;
     }
     async connect() {
          try {
               this.connection = await this.createConnection();
               await this.sendPing();
          } catch (error) {
               throw error;
          }
     }

     createConnection() {
          return new Promise((resolve, reject) => {
               const connection = net.createConnection({
                    host: this.host,
                    port: this.port,
               });

               connection.on('connect', () => {
                    resolve(connection);
               });
               connection.on('error', (error) => {
                    reject(error);
               });
               connection.on('data', (data) => {
                    const message = Buffer.from(data).toString().trim();
                    console.log("message",message.split('\r\n').length)
                    const parsedObject = redisParser(message);
                    const result = redisResponse(
                         parsedObject.command,
                         parsedObject.commandArg
                    );
                    connection.write(result);
               });
          });
     }

     async sendPing() {
          try {
               await this.connection.write('*1\r\n$4\r\nPING\r\n');
          } catch (error) {
               throw error;
          }
     }
}
