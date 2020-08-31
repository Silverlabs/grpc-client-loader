const assert = require('assert');
const path = require('path');
const Grpcx = require('@silverlabs/grpcx');

const grpcClientLoader = require('../src');

describe('grpc-client-loader', () => {
  it('loads clients from proto files in a directory', () => {
    const clients = grpcClientLoader({
      connStr: 'test',
      dirPath: __dirname,
    });
    assert.equal(Object.keys(clients).length, 2);
  });

  it('provides interface to run function in service definittion as promise', async () => {
    let server;

    afterEach(() => {
      server.forceShutdown();
    });

    const app = new Grpcx({ protoFile: path.join(__dirname, 'example.proto') });
    app.use('hello', ({ name }) => ({ message: `Hello ${name}` }));
    server = await app.listen(3456);

    const clients = grpcClientLoader({
      connStr: 'localhost:3456',
      dirPath: __dirname,
    });
    const response = await clients.example.hello({ name: 'test' });
    assert.equal(response.message, 'Hello test');
  });

  it('adds mods which can modify args', async () => {
    let server;

    afterEach(() => {
      server.forceShutdown();
    });

    const app = new Grpcx({ protoFile: path.join(__dirname, 'example.proto') });
    app.use('hello', ({ name }) => ({ message: `Hello ${name}` }));
    server = await app.listen(3456);

    const clients = grpcClientLoader({
      connStr: 'localhost:3456',
      dirPath: __dirname,
      mods: [(args) => { Object.assign(args, { name: 'mod' }); }],
    });
    const response = await clients.example.hello({ name: 'test' });
    assert.equal(response.message, 'Hello mod');
  });

  it('adds mods which can modify metadata', async () => {
    let server;

    afterEach(() => {
      server.forceShutdown();
    });

    const app = new Grpcx({ protoFile: path.join(__dirname, 'example.proto') });
    app.use((call, callback, next) => {
      const metaField = call.metadata.get('metaField');
      Object.assign(call.request, { metaField });
      return next();
    });
    app.use('hello', ({ name, metaField }) => ({ message: `Hello ${name} ${metaField}` }));
    server = await app.listen(3456);

    const clients = grpcClientLoader({
      connStr: 'localhost:3456',
      dirPath: __dirname,
      mods: [(args, metadata) => { metadata.add('metaField', 'test meta'); }],
    });
    const response = await clients.example.hello({ name: 'test' });
    assert.equal(response.message, 'Hello test test meta');
  });
});
