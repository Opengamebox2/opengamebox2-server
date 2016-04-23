import socketio from 'socket.io';
const io = socketio();
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

let nextEntityId = 0;

io.on('connection', socket => {
  console.log(`Client ${socket.remoteAddress} connected. (${socket.id})`);

  
  const arr = [];
  Object.keys(entities).forEach(key => arr.push(entities[key]));
  socket.emit(types.ENTITY_CREATE, arr);
  socket.join(channels.GAME);
  
  socket.on(types.ENTITY_CREATE_REQUEST, entityArr => {
    const createList = [];
    entityArr.forEach(entity => {
      const id = ++nextEntityId;
      entity.id = id;
      entities[id] = entity;
      createList.push(entity);
    });
    io.to(channels.GAME).emit(types.ENTITY_CREATE, createList);
  });

  socket.on(types.ENTITY_DELETE_REQUEST, entityArr => {
    const deleteList = [];
    entityArr.forEach(entity => {
      const id = entity.id;
      if (entities[id]) {
        delete entities[id];
        deleteList.push({id});
      }
    });
    io.to(channels.GAME).emit(types.ENTITY_DELETE, deleteList);
  });

  socket.on(types.ENTITY_SELECT_REQUEST, entityArr => {
    const updateList = [];
    Object.keys(entities).forEach(key => {
      let entity = entities[key];

      if (entity.selectedClientId === null || 
            entity.selectedClientId === socket.id.substr(2)) {
        entity.selectedClientId = entityArr.find(ent => entity.id === ent.id) ? socket.id.substr(2) : null;
        updateList.push({id: entity.id, selectedClientId: entity.selectedClientId});
      }
    });

    if (updateList.length !== 0) {
      io.to(channels.GAME).emit(types.ENTITY_SELECT, updateList);
    }
  });

  socket.on('disconnect', () => {
    console.log(`Client ${socket.remoteAddress} disconnected. (${socket.id})`);
  });
});


io.listen(8000);




/**
 * @param {Type}
 * @return {Type}
 */
export default function () {
  return true
}
