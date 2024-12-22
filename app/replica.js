import net from 'node:net';
import { redisParser, redisResponse } from './redisHandler.js';
import { resolve } from 'node:path';

export class RedisMaster {
     constructor(masterHost, masterPort, replicaPort) {
          this.host = masterHost;
          this.port = masterPort;
          this.replicaPort = replicaPort;
          this.connection = null;
          this.pendingCommand = null;
          this.commandQueue = [];
          this.processingCommand = false;
     }

     async connect() {
          this.connection = await this.createConnection();
     }

     createConnection() {
          return new Promise((resolve, reject) => {
               const connection = net.createConnection({
                    host: this.host,
                    port: this.port,
               });

               connection.on('connect', () => resolve(connection));
               connection.on('error', reject);
               connection.on('data', this.handleResponse.bind(this));

               connection.setEncoding('utf8');
          });
     }

     async handleMessage() {
          console.log('At handle message function');
          if (this.pendingCommand) return;
          this.pendingCommand = true;
          console.log('Going inside the command queue');
          while (this.commandQueue.length) {
               const parsedCommandObject = this.commandQueue.shift();
               console.log(
                    'parsedCommandObject',
                    JSON.stringify(parsedCommandObject)
               );
               for (let i = 0; i < parsedCommandObject.command.length; i++) {
                    const command = parsedCommandObject.command[i];
                    const commandArg = parsedCommandObject.commandArg[i];
                    const result = redisResponse(command, commandArg);
                    console.log('redis result', result);
                    this.connection.write(result);
               }
               await new Promise((resolve) => setTimeout(resolve, 0));
          }
          this.pendingCommand = false;
     }

     async handleResponse(data) {
          if (this.pendingCommand && data.includes('\r\n')) {
               const response = data.slice(0, data.indexOf('\r\n'));
               this.pendingCommand.resolve(response);
               this.pendingCommand = null;
          } else {
               console.log('Got the commands from master');
               const message = Buffer.from(data).toString().trim();
               let parsedObject = redisParser(message);

               console.log('parsed obj replica', JSON.stringify(parsedObject));
               this.commandQueue.push(parsedObject);
               await this.handleMessage();
          }
     }

     sendCommand(command) {
          return new Promise((resolve, reject) => {
               if (this.pendingCommand) {
                    reject(new Error('Another command is already in progress'));
                    return;
               }

               this.pendingCommand = { resolve, reject };
               this.connection.write(command, (err) => {
                    if (err) {
                         this.pendingCommand.reject(err);
                         this.pendingCommand = null;
                    }
               });
          });
     }

     sendPing() {
          return this.sendCommand('*1\r\n$4\r\nPING\r\n');
     }

     sendListeningPort() {
          return this.sendCommand(
               `*3\r\n$8\r\nREPLCONF\r\n$14\r\nlistening-port\r\n$4\r\n${this.replicaPort}\r\n`
          );
     }

     sendCapa() {
          return this.sendCommand(
               '*3\r\n$8\r\nREPLCONF\r\n$4\r\ncapa\r\n$6\r\npsync2\r\n'
          );
     }

     sendPsync() {
          return this.sendCommand(
               '*3\r\n$5\r\nPSYNC\r\n$1\r\n?\r\n$2\r\n-1\r\n'
          );
     }
}