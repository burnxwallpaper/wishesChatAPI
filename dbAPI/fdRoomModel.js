const mongoose = require('mongoose');

const { Schema } = mongoose;

const fdRoomModel = new Schema(
    {
        users: { type: Array },
        msg: { type: {} },
        roomType: { type: String },

    }
)

module.exports = mongoose.model('fdRoomModel', fdRoomModel, "room");