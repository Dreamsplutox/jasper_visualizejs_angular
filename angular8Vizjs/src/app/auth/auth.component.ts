import { Component, OnInit, OnDestroy } from '@angular/core';
import { AuthService } from '../services/auth.services';
import { VizjsViewService } from '../services/vizjs-view.services';
import { NgForm } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-auth',
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.scss']
})
export class AuthComponent implements OnInit, OnDestroy {

  authStatus: boolean;
  authTimeouts = [];

  constructor(private authService: AuthService, private vizjsViewService: VizjsViewService,
   private router: Router) { }

  ngOnInit() {
    this.authStatus = this.authService.isAuth;

    if(this.authStatus){
      var instance = this;
      instance.authTimeouts.push(setTimeout(function() {
        console.log("timeout function auth : "+instance.authStatus);
        console.log("you stayed too much time inactive on the auth page, disconnection");
        alert("Vous êtes restés trop longtemps inactif sur la page, deconnexion");
        instance.onSignOut();
      }, instance.authService.inactive_timeout, instance));
    }
  }

  ngOnDestroy(){
    console.log("destroy all timeouts of auth component");
    //clear all active "set time out" functions
    for(var i=0; i < this.authTimeouts.length; i++){
      clearTimeout(this.authTimeouts[i]);
    }
    this.authTimeouts = [];
  }

  //When the form is submitted, call a promise from authService, if it is successfull,
  // init variables and go to vizjs-view
  onSubmit(form: NgForm){
    const tempo_j_username = form.value['n_j_username'];
    const tempo_j_password  = form.value['n_j_password'];
    //use auth service to check if the connection is OK, 
    // if it is the case SignIn + status to true, if not, throw an error
    this.authService.signIn(tempo_j_username, tempo_j_password).then(
      success => {
        console.log('Sign in successful!');
        this.authService.setUsername(tempo_j_username);
        this.authService.setPassword(tempo_j_password);
        this.authService.isAuth = true;
        this.authStatus = this.authService.isAuth;
        this.router.navigate(['vizjs-view']);
        //console.log("you should be in init visualizeJS view stat = "+ this.authStatus);
      },
      error => {
        console.log("Sign in not successfull");
        alert("Authorization failed, please try again !");
        //reset form inputs
        form.reset();
      }
    );
  }

  //Change the Auth to false, the user can no longer access to other pages
  onSignOut() {
    //javascript method, refresh with window location to force complete application reinitialisation
    window.location.reload(true);    
    // //classic method, reinit each value manually
    // this.authService.signOut();
    // this.authStatus = this.authService.isAuth;
    // //reinit other service values
    // this.vizjsViewService.custom_default_values_dict = null;
    // this.vizjsViewService.custom_default_values_activate = false;
    // this.vizjsViewService.show_default_values_HTML = ["", "", "", "", ""];
  }

}
