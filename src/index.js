const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

function getProtoFiles(dirPath) {
  const files = fs.readdirSync(dirPath);
  return files.filter((file) => file.endsWith('.proto'));
}

function getPackageName(file) {
  return file.replace('.proto', '').replace('-', '_');
}

function getServiceName(file) {
  return getPackageName(file)
    .split('_')
    .map((str) => `${str[0].toUpperCase()}${str.slice(1)}`)
    .join('');
}

function loadProto({ filePath, packageName }) {
  const packageDef = protoLoader.loadSync(filePath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  return grpc.loadPackageDefinition(packageDef)[packageName];
}

function createClient({
  proto,
  serviceName,
  connStr,
  mods,
}) {
  const client = new proto[serviceName](connStr, grpc.credentials.createInsecure());
  Object.keys(Object.getPrototypeOf(client)).forEach((funcName) => {
    const func = client[funcName];
    client[funcName] = (args, metadataParam) => {
      const metadata = metadataParam || new grpc.Metadata();
      if (mods) mods.forEach((mod) => mod(args, metadata));
      return promisify(func).call(client, args, metadata);
    };
  });
  return client;
}

function getClient({
  connStr,
  dirPath,
  file,
  mods,
}) {
  const packageName = getPackageName(file);
  const serviceName = getServiceName(file);
  const filePath = path.join(dirPath, file);

  const proto = loadProto({ filePath, packageName });
  return {
    [packageName]: createClient({
      proto,
      serviceName,
      connStr,
      mods,
    }),
  };
}

function getClients({ connStr, dirPath, mods }) {
  const files = getProtoFiles(dirPath);
  return files.reduce((acc, cur) => ({
    ...acc,
    ...getClient({
      connStr,
      dirPath,
      file: cur,
      mods,
    }),
  }), {});
}

module.exports = getClients;
