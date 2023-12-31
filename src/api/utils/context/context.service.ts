import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { Request } from 'express';

export interface Context {
  id: string;
}

@Injectable()
export class ContextService {
  constructor (
    private als: AsyncLocalStorage<Request>
  ) { }

  start(request: Request, cb: () => any) {
    this.als.run(request, cb);
  }

  getContext() {
    return this.als.getStore();
  }
}
