import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { SafeModule } from './safe/safe.module.js';
import { MongooseModule } from '@nestjs/mongoose';
import { UserModule } from './user/user.module.js';
import { AuthModule } from './auth/auth.module.js';
@Module({
  imports: [
    ConfigModule.forRoot(),
    SafeModule,
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://localhost/safe'),
    UserModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

// implements NestModule {
//   configure(consumer: MiddlewareConsumer) {
//     consumer
//       .apply(
//         cookieParser(process.env.COOKIE_SECRET || 'your-cookie-secret'),
//         session({
//           store: MongoStore.create({
//             mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost/safe'
//           }),
//           secret: process.env.SESSION_SECRET || 'your-session-secret',
//           resave: false,
//           saveUninitialized: false,
//           cookie: {
//             maxAge: 24 * 60 * 60 * 1000, // 24 hours
//             secure: process.env.NODE_ENV === 'production',
//             sameSite: 'lax'
//           }
//         })
//       )
//       .forRoutes('*');
//   }
// } 