import {
    ExecutionContext,
    Injectable,
    UnauthorizedException,
  } from '@nestjs/common';
  import { AuthGuard } from '@nestjs/passport';
  
  @Injectable()
  export class PasskeyAuthGuard extends AuthGuard('webauthn') {
    canActivate(context: ExecutionContext) {
        console.log('PasskeyAuthGuard canActivate');

        console.log(context);

        const req = context.switchToHttp().getRequest();
        const register = (username: string, options: any) => {
            console.log('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
        };
        req.register = register;
      // Add your custom authentication logic here
      // for example, call super.logIn(request) to establish a session.
      return super.canActivate(context);
    }
  
    handleRequest(err, user, info) {
        console.log('PasskeyAuthGuard handleRequest');

        console.log(err, user, info);
      // You can throw an exception based on either "info" or "err" arguments
      if (err || !user) {
        throw err || new UnauthorizedException();
      }
      return user;
    }
  }