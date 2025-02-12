import { Controller, Post, Get, Req, UseGuards, Res, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { WebAuthnStrategy } from './webauthn.strategy.js';
import { SessionGuard } from './session.guard.js';
import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import base64url from 'base64url';


@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private webAuthnStrategy: WebAuthnStrategy,
  ) {}

  @Post('passkey/challenge')
  async getPasskeyChallenge(@Req() req) {

    const userId = base64url.default.encode(uuidv4());
    const user = {
      id: userId,
      username: req.body.username || userId,
    };
    return new Promise((resolve, reject) => {

      // sign in with passkey
      if (user.id === user.username) {

        this.logger.log('Generating login challenge');
        
        this.webAuthnStrategy.getStore().challenge(req, (err, challenge) => {
          if (err) reject(err);
          if (!challenge) reject(new Error('No challenge generated'));

          this.logger.log('challenge:', challenge);

          const data = {challenge: base64url.default.encode(challenge!)}

          req.session['webauthn'] = data;
          req.session.save();

          // console.log('Session after setting challenge:', req.session);
  
          resolve(data);
        });
      } else {

        // registrer passkey
        this.logger.log('Generating registration challenge');
        this.webAuthnStrategy.getStore().challenge(req, { user: user }, (err, challenge) => {
          if (err) reject(err);
          if (!challenge) reject(new Error('No challenge generated'));
  
          const data = { 
            user,
            challenge: base64url.default.encode(challenge!)
          };

          this.logger.log('data:', {user, challenge});
          
          // Store challenge under 'webauthn' key in session
          req.session['webauthn'] = data;
          req.session.save();
  
          resolve(data);
        });
      }
    });
  }

  @Post('passkey/verify')
  @UseGuards(AuthGuard('webauthn'))
  async verifyPasskey(@Req() req) {

    this.logger.log('verification complete');

    return req.user;
  }

  // @Post('ethereum')
  // async verifyEthereum(@Body() body: SiweVerifyDto) {
  //   return this.siweService.verify(body);
  // }

  // @Get('protected-route')
  // @UseGuards(SessionGuard)
  // async protectedRoute(@Req() req) {
  //   return { message: 'You are authenticated', userId: req.session.userId };
  // }

  @Post('logout')
  async logout(@Req() req, @Res() res: Response) {
    req.session.destroy(err => {
      if (err) {
        return res.status(500).send('Could not log out');
      }
      res.clearCookie('connect.sid'); // Clear the session cookie
      return res.send('Logged out');
    });
  }
} 