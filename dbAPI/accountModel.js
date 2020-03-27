const mongoose = require('mongoose');

const { Schema } = mongoose;

const accountModel = new Schema(
    {
        username: { type: String },
        password: { type: String },
        //information: { type: String },
        friends: { type: Array },
        fdRooms: { type: Array },
        fdRequestReceived: { type: Array },
        fdRequestSent: { type: Array },
        iconImage: { type: String }
    }
)

module.exports = mongoose.model('accountModel', accountModel, "account");