declare var visualize: any;

export class AuthService {

  //Usefull authorization variables, needed later for visualizeJS features
  isAuth = false;
  visualize;
  private username = "";
  private password = "";
  inactive_timeout = 900000; //15min timeout

  myService = this;

  //Return a promise to auth.component.ts, the processing will be done there
  signIn(j_username: string, j_password: string) {
    return new Promise<void>(
      (resolve, reject) => {
      
      visualize({
        auth: {
          name: j_username,
          password: j_password
        }
      },
        function() { 
          //console.log("resolve ok");
          resolve();
        }, // successful validation
        function() { 
          //console.log("resolve not ok");
          reject(); 
        }); // unsuccessful validation
    });
  }

  //Change isAuth attribute to false to disconnect (only auth pages available)
  signOut() {
    this.isAuth = false;
  }

  //Setters for credentials
  setUsername(j_username){
    this.username = j_username;
  }

  setPassword(j_password){
    this.password = j_password;
  }

  //Getters for credentials
  getUsername(){
    return this.username;
  }

  getPassword(){
    return this.password;
  }
}