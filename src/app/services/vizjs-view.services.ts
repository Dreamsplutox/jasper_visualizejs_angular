declare var visualize: any;

export class VizjsViewService {

  //usefull variables to get informations on visualizeJS resources
  myVizjs = this; 
  resources_informations = null;
  folder_choice = "/L4_logistics/Conception/rapports_test/test/test_mongodb";//"/L4_logistics/Services/Méthodes";//"/L4_logistics/Services/Exploitation";//"/L4_logistics/Conception/rapports_test/test/test_mongodb";
  //custom search variables
  resources_types_custom_search = ["reportUnit", "dashboard", "adhocDataView"];
  search_query = "";
  custom_search_activate = false;
  //default values of inputControls (can be modified)
  custom_params = null;
  //params gived by a CSV ? if true need verifications
  verif_custom_params_from_file = false;

  //return the name of the current "source" folder
  getFolderChoice(){
  	return this.folder_choice;
  }

  //return a promise with all resources found with the "resourcesSearch" visualizeJS feature
  getResourcesInformation(folder_choice:string, username: string, password: string){
	visualize.config({
	    auth: {
	        name: username,
	        password:password
	    }
	});

	return new Promise(
      (resolve, reject) => {
  		visualize(function (v) {
	        //Get list of ressources (specific location)
	        v.resourcesSearch({
	            folderUri: folder_choice,
	            //q: "colis",
	            sortBy: "uri",
	            recursive: true,
	            types: ["dashboard", "reportUnit", "adhocDataView", "folder"],
	            success: function (informations) {
	            	//console.log("success resources informations search "+informations);
	            	//console.log("service informations = "+this.resources_informations);
					console.log("resolve");
					resolve(informations);
	            },
	            error: function (err) {
	                //console.log("An error has occured, folder choice was "+folder_choice);
	                console.log("err : "+err);
					reject();
	            }
	        });
    	});
    });
  }

  //return a promise with all folders found with the "resourcesSearch" visualizeJS feature
  getFoldersInformation(folder_choice:string, username: string, password: string){
	visualize.config({
	    auth: {
	        name: username,
	        password:password
	    }
	});

	return new Promise(
      (resolve, reject) => {
  		visualize(function (v) {
	        //Get list of ressources (specific location)
	        v.resourcesSearch({
	            folderUri: folder_choice,
	            sortBy: "uri",
	            recursive: true,
	            types: ["folder"],
	            success: function (informations) {
	            	console.log("success folders informations search "+informations);
	            	console.log("service informations = "+this.resources_informations);
					resolve(informations);
	            },
	            error: function (err) {
	                console.log("An error has occured, folder choice was "+folder_choice);
	                console.log(err);
					reject();
	            }
	        });
    	});
    });
  }


  //return a promise with all resources found with the "resourcesSearch" for our CustomSearch
  getResourcesInformationCustomSearch(folder_choice:string, search_query:string, resources_types:any, username: string, password: string){
	visualize.config({
	    auth: {
	        name: username,
	        password:password
	    }
	});

	return new Promise(
      (resolve, reject) => {
  		visualize(function (v) {
	        //Get list of ressources (specific location)
	        v.resourcesSearch({
	            folderUri: folder_choice,
	            q: search_query,
	            sortBy: "uri",
	            recursive: true,
	            types: resources_types,
	            success: function (informations) {
	            	console.log("success resources informations custom search "+informations);
	            	console.log("service informations = "+this.resources_informations);
					resolve(informations);
	            },
	            error: function (err) {
	                console.log("An error has occured, folder choice was "+folder_choice);
	                console.log(err);
					reject();
	            }
	        });
    	});
    });
  }
}