const net = require('node:net');

const server = net.createServer((connection) => {
     // Handle connection
    //  console.log("client connected");
    //  connection.on("end", () => {
    //     //   console.log("Client disconnected");
    //  });
    connection.write('+PONG\r\n');
    //  connection.pipe(connection);
});
// server.on("error", (error) => {
//      throw error;
// });
server.listen(6379, "127.0.0.1");

