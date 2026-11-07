import mongoose from "mongoose";
import { DB_URI } from "../config.js";
import express from 'express'

export const bootstrapDB=async(app:express.Application,port:number)=>{
    try {
        await mongoose.connect(DB_URI,{serverSelectionTimeoutMS:30000})
        console.log('connect on DB ');
        app.listen(port,()=>console.log(`app is listening on port : ${port} `))
    } catch (error) {
        console.log({error});
        console.log(`fail on connecting DB`);
        process.exit(1)
    }
}
