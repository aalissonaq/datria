import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PrismaModule } from "../../prisma/prisma.module";
import { AuthenticationGuard } from "./authentication.guard";
import { TenantContextResolver } from "./tenant-context.resolver";
import { PolicyService } from "./policy.service";

@Global()
@Module({
  imports: [ConfigModule, PrismaModule, JwtModule.register({})],
  providers: [AuthenticationGuard, TenantContextResolver, PolicyService],
  exports: [
    AuthenticationGuard,
    TenantContextResolver,
    PolicyService,
    JwtModule,
  ],
})
export class AuthorizationModule {}
