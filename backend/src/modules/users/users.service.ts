import { Injectable } from '@nestjs/common';
import { UserDocument } from './schemas/user.schema';
import { CreateUserInput, UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  create(input: CreateUserInput): Promise<UserDocument> {
    return this.usersRepository.create(input);
  }

  findByEmail(email: string): Promise<UserDocument | null> {
    return this.usersRepository.findByEmail(email);
  }

  findById(id: string): Promise<UserDocument | null> {
    return this.usersRepository.findById(id);
  }

  setRefreshTokenHash(id: string, hash: string | null): Promise<void> {
    return this.usersRepository.setRefreshTokenHash(id, hash);
  }
}
