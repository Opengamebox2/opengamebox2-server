import {types, channels} from '../protocol/protocol';

/**
 * entity
 * - id
 * - imgHash
 * - pos.x
 * - pos.y
 * - selectedClientId
 */
const entities = {};

export function run(worker) {
  console.log('   >> Worker PID:', process.pid);
  const httpServer = worker.httpServer;
  const scServer = worker.scServer;

  let nextEntityId = 0;

  scServer.on('connection', socket => {
    console.log(`Client ${socket.remoteAddress} connected. (${socket.id})`);

    socket.on(channels.GAME, packet => {
      switch (packet.type) {
        case types.HANDSHAKE: {
          const arr = [];
          Object.keys(entities).forEach(key => arr.push(entities[key]));
          socket.emit(channels.GAME, {type: types.ENTITY_CREATE, data: arr});
        } break;

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

        case types.ENTITY_SELECT_REQUEST: {
          const idArr = packet.data;
          const updateList = [];
          Object.keys(entities).forEach(key => {
            let entity = entities[key];

            if (entity.selectedClientId === null || 
                  entity.selectedClientId === socket.id) {
              entity.selectedClientId = idArr.find(id => entity.id === id) ? socket.id : null;
              updateList.push({id: entity.id, selectedClientId: entity.selectedClientId});
            }
          });

          if (updateList.length !== 0) {
            scServer.exchange.publish(channels.GAME, {type: types.ENTITY_SELECT, data: updateList});
          }
        } break;
      }
    });

    socket.on('disconnect', () => {
      console.log(`Client ${socket.remoteAddress} disconnected. (${socket.id})`);
    });
  });
}
