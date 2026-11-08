import mongoose from 'mongoose';
import { AppError } from './AppError.js';

export function isValidObjectId(id) {
  if (typeof id !== 'string' && !(id instanceof mongoose.Types.ObjectId)) {
    return false;
  }
  return mongoose.Types.ObjectId.isValid(String(id)) &&
    String(new mongoose.Types.ObjectId(String(id))) === String(id);
}

export function assertObjectId(id, label = 'Resource ID') {
  if (!isValidObjectId(id)) {
    throw new AppError(`Invalid ${label} format.`, 400, 'INVALID_OBJECT_ID');
  }
}

