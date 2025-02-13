import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class SessionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    console.log('SessionGuard hit');

    console.log('REQUEST', request);
    
    // Check if the session exists and contains a userId
    if (!request.session || !request.session.user) {
      throw new UnauthorizedException('User not authenticated');
    }
    
    return true;
  }
} 