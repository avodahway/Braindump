import { createBrainDumpNodeServer, nodeServerPort } from './nodeServer';

const port = nodeServerPort();
const server = createBrainDumpNodeServer();

server.listen(port, () => {
  console.log(`Brain Dump backend listening on port ${port}`);
});
