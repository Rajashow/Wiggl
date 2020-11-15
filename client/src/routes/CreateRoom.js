import React from "react";
import { v1 as uuid } from "uuid";

const CreateRoom = (props) => {
  function create() {
    const id = uuid();
    props.history.push(`/room/${id}`);
  }

  return (
    <div class="container">
      <div class="vertical-center">
        <button onClick={create}>Create Room</button>
      </div>
    </div>
  );
};

export default CreateRoom;
