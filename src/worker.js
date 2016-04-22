import {types, channels} from '../protocol/protocol';

const entities = {};

export function run(worker) {
  console.log('   >> Worker PID:', process.pid);
  const httpServer = worker.httpServer;
  const scServer = worker.scServer;

  let nextEntityId = 0;

  scServer.on('connection', socket => {
    console.log(`Client ${socket.remoteAddress} connected. (${socket.id})`);

    const arr = [];
    Object.keys(entities).forEach(key => arr.push(entities[key]));
    socket.emit(channels.GAME, {type: types.ENTITY_CREATE, data: arr});

    socket.on(channels.GAME, packet => {
      switch (packet.type) {
        case types.ENTITY_CREATE_REQUEST: {
          let entity = packet.data;
          const id = ++nextEntityId;
          entity.id = id;
          entities[id] = entity;
          scServer.exchange.publish(channels.GAME, {type: types.ENTITY_CREATE, data: [entity]});
        } break;
        
        case types.ENTITY_DELETE_REQUEST: {
          const id = packet.data.id;
          if (entities[id]) {
            delete entities[id];
            scServer.exchange.publish(channels.GAME, {type: types.ENTITY_DELETE, data: {id}});
          }
        } break;
      }
    });

    socket.on('disconnect', () => {
      console.log(`Client ${socket.remoteAddress} disconnected. (${socket.id})`);
    });
  });
}
