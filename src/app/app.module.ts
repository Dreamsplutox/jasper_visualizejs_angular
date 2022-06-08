import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { VizjsViewComponent } from './vizjs-view/vizjs-view.component';
import { VizjsConfigComponent } from './vizjs-config/vizjs-config.component';
import { VizjsViewService } from './services/vizjs-view.services';
import { AuthComponent } from './auth/auth.component';
import { AuthService } from './services/auth.services';
import { AuthGuard } from './services/auth-guard.services';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule } from '@angular/forms';

const appRoutes: Routes = [
  { path: 'vizjs-view', canActivate: [AuthGuard], component: VizjsViewComponent },
  { path: 'vizjs-config', canActivate: [AuthGuard], component: VizjsConfigComponent },
  { path: 'auth', component: AuthComponent },
  { path: '', component: AuthComponent },
];

@NgModule({
  declarations: [
    AppComponent,
    VizjsViewComponent,
    AuthComponent,
    VizjsConfigComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    RouterModule.forRoot(appRoutes)
  ],
  providers: [
    VizjsViewService,
    AuthService,
    AuthGuard
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
