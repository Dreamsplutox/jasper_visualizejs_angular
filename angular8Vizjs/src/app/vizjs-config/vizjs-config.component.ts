import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { VizjsViewService } from '../services/vizjs-view.services';
import { AuthService } from '../services/auth.services';
import { NgForm } from '@angular/forms';
import { Router } from '@angular/router';

declare var $: any;
declare var visualize: any;

@Component({
  selector: 'app-vizjs-config',
  templateUrl: './vizjs-config.component.html',
  styleUrls: ['./vizjs-config.component.scss']
})

export class VizjsConfigComponent implements OnInit, OnDestroy {
  	//this folder choice attribute is used in the HTML view (easier manipulation for the user)
	folder_choice = "";
	//this is a list of authorized folder for the user (if the user haven't the authorization)
	authorized_folder = ["/public/test","/public/test_droits_scriptlet","/L4_logistics/Conception/rapports_test/test/test_mongodb",
		 "/L4_logistics/Conception/rapports_test/copy_reports"];
	resources_types_custom_search;
	resources_type_1 = false;
	resources_type_2 = false;
	resources_type_3 = false;
	search_query = "";
	custom_search_activate:boolean;
	//Handle timeouts
	vizjs_config_timeouts = [];
	//input controls
	inputControls = null;
	custom_params = null;
	verif_custom_params_from_file = false;

	constructor(private vizjsViewService: VizjsViewService, private authService: AuthService,
	private router: Router, private zone: NgZone) { }

	ngOnInit() {
		
		//trigger disconnection if the user is on this page too much time 
		// (any action redirect him, he is not supposed to stay here for a long time)
      	var instance = this;
      	instance.vizjs_config_timeouts.push(setTimeout(function() {
        	console.log("timeout function vizjs-config");
        	console.log("you stayed too much time inactive on the vizjs-config page, disconnection");
        	alert("Vous êtes restés trop longtemps inactif sur la page, deconnexion");
        	//sign out
        	instance.authService.signOut();
	        instance.zone.run(() => {
          		instance.router.navigate(['/auth']);
        	});
      	}, instance.authService.inactive_timeout, instance));

		this.folder_choice = this.vizjsViewService.folder_choice;
		this.search_query = this.vizjsViewService.search_query;
		this.resources_types_custom_search = this.vizjsViewService.resources_types_custom_search;
		//init custom parameters
		this.custom_params = this.vizjsViewService.custom_params;
		this.verif_custom_params_from_file = this.vizjsViewService.verif_custom_params_from_file;

		//init resources_types var, only usefull to display current configuration
		if(this.resources_types_custom_search.includes("reportUnit")){
			this.resources_type_1 = true;
		}
		if(this.resources_types_custom_search.includes("dashboard")){
			this.resources_type_2 = true;
		}
		if(this.resources_types_custom_search.includes("adhocDataView")){
			this.resources_type_3 = true;
		}

		this.custom_search_activate = this.vizjsViewService.custom_search_activate;

		//Handle custom inputControls jasper UI
		this.createJasperUI();
		
		//empty all custom input controls (BeginDateO:17-05-20 ===> BeginDate0:)
        $( "#reset_custom_input_control").click(function() {
          instance.resetCustomInputControls();
        });
        
        //create on click event to export custom_params into a CSV file
        $( "#export_custom_input_control").click(function() {
          instance.exportCustomParamsToCSV();
        });

        //handle dragOver and drop events to import custom params from a CSV
        $( "#drop_zone").on("dragover", function(event) {
          instance.dragOverHandler(event);
        });
        $( "#drop_zone").on("drop", function(event) {
          instance.dropHandler(event);
        });

	}

	ngOnDestroy(){
		console.log("destroy all timeouts of vizjs-config component");
	    //clear all active "set time out" functions
	    for(var i=0; i < this.vizjs_config_timeouts.length; i++){
	      clearTimeout(this.vizjs_config_timeouts[i]);
	    }
	    this.vizjs_config_timeouts = [];
	}

	//function to update the folder => the folder choice attribute of the service will change
	// and the user is redirect to the new visualizeJS page (with new resources available) 
	onUpdateFolder(form: NgForm) {
		var new_folder = form.value["input_folder_choice"];

		//first get folder information
        this.vizjsViewService.getFoldersInformation(
          new_folder, this.authService.getUsername(), this.authService.getPassword()
        ).then(
          success => {
            //print results
            console.log("Get folder information successfull ! => "+success);    

            //if the function returned something, the user is authorized to use this folder
            if(success[0] !== undefined){
	            //console.log("success 0 : |"+success[0]+"| get props : "+Object.getOwnPropertyNames(success));
	            //trigger click event
			    alert("dossier mis à jour");
			    this.vizjsViewService.folder_choice = new_folder;
			    //change folder not very usefull here, only usefull if we don't change view
			    this.folder_choice = this.vizjsViewService.folder_choice;
			    // //this.router.navigate(['vizjs-view']);
			    this.zone.run(() => {
	      		    this.router.navigate(['vizjs-view']);
	    	    });
            }
            //else the user isn't authorized and a special alert is triggered
            else{
            	alert("Le dossier est vide pour votre compte utilisateur (vous n\'avez peut être pas les permissions nécessaires)");
            }
          },
          error => {
            console.log("get folder information failed");
            alert("Choix de dossier invalide ! Vérifiez le chemin entré");
          }
        );
	}

	onCustomSearch(form: NgForm){
		console.log("form data => q:"+form.value["input_search_query"]+" typ1:"+form.value["input_type_resource_1"]+
			" typ2:"+form.value["input_type_resource_2"]+" typ3:"+form.value["input_type_resource_3"]);

		//reset var
		this.resources_types_custom_search = [];

		//check if variables are set => at least one variable type should be equal to input_type_resource_3
		if(form.value["input_type_resource_1"] == false && form.value["input_type_resource_2"] == false &&
			form.value["input_type_resource_3"] == false){
			//keep old resources types
			this.resources_types_custom_search = this.vizjsViewService.resources_types_custom_search;

			//init resources_types var, only usefull to display current configuration
			if(this.resources_types_custom_search.includes("reportUnit")){
				this.resources_type_1 = true;
				form.controls['input_type_resource_1'].setValue(true);
			}
			if(this.resources_types_custom_search.includes("dashboard")){
				this.resources_type_2 = true;
				form.controls['input_type_resource_2'].setValue(true);
			}
			if(this.resources_types_custom_search.includes("adhocDataView")){
				this.resources_type_3 = true;
				form.controls['input_type_resource_3'].setValue(true);
			}


			alert("Au moins un type de ressource doit être sélectionné !");
			return;
		}

		//build the array of resources types used for the custom search
		if(form.value["input_type_resource_1"] == true){
			this.resources_types_custom_search.push("reportUnit");
		}
		if(form.value["input_type_resource_2"] == true){
			this.resources_types_custom_search.push("dashboard");
		}
		if(form.value["input_type_resource_3"] == true){
			this.resources_types_custom_search.push("adhocDataView");
		}

		//set global variables on (resources types + search query + custom_search_activate)
		this.vizjsViewService.resources_types_custom_search = this.resources_types_custom_search;
		this.vizjsViewService.search_query = this.search_query;
		this.vizjsViewService.custom_search_activate = true;
		//this.custom_search_activate = true;

		//try to get ressources informations (test if there are ressources)
		this.vizjsViewService.getResourcesInformationCustomSearch(
            this.folder_choice, this.vizjsViewService.search_query, this.vizjsViewService.resources_types_custom_search,
             this.authService.getUsername(), this.authService.getPassword()).then(
              success => {
                console.log("Get custom search resources infos successfull ! => "+success);
                //if the function returned something, there are resources in the folder 
                // / the user is authorized to use resources, redirect to vizjs-virw
	            if(success[0] !== undefined){
		            //console.log("success 0 : |"+success[0]+"| get props : "+Object.getOwnPropertyNames(success));
		            //trigger click event

				    this.zone.run(() => {
		      		    this.router.navigate(['vizjs-view']);
		    	    });
	            }
	            //else the user isn't authorized / the search returned nothing and a special alert is triggered
	            else{
	            	alert("Aucune ressource ne répond aux critères de recherches dans le dossier source (vous n\'avez peut être pas les permissions nécessaires)");
	            }
              },
              error => {
                console.log("get custom search resources infos failed");
              }
            );

		//redirect to vizjs-view
		this.zone.run(() => {
          	this.router.navigate(['vizjs-view']);
        });

	}

	deactivateSearchMode(){
		console.log("deactivate");
		this.resources_type_1 = true;
		this.resources_type_2 = true;
		this.resources_type_3 = true;
		this.custom_search_activate = false;
		this.search_query = "";
		this.resources_types_custom_search = ["reportUnit", "dashboard", "adhocDataView"];

		this.vizjsViewService.custom_search_activate = false;
		this.vizjsViewService.search_query = "";
		this.vizjsViewService.resources_types_custom_search = ["reportUnit", "dashboard", "adhocDataView"];
	}


	//create inputControls with jasper UI
	createJasperUI(){
		var instance = this;
		visualize.config({
		    auth: {
	        	name: instance.authService.getUsername(),
	        	password:instance.authService.getPassword()
		    }
	  	});

	  	visualize(function (v) {
	  		/// input controls section ///
	  		instance.inputControls = v.inputControls({
		        resource: "/public/test/config_custom_ic",//"/L4_logistics/Conception/rapports_test/test/test_mongodb/sous_dossier_num_2/config_custom_ic",//Ruptures_par_client_et_par_jour__Détails__1",//Ruptures_par_client_et_par_jour__Détails_",
		        container: "#ic",
		        params: instance.verif_custom_params_from_file == true ? instance.custom_params : {},
		        events: {
		            change: function (params, error) {
		                // Update my_params variable when the values doesn't trigger an error, it will be
		                //used to load the report when you want to run a report with specific parameters
		                console.log("change ic");
		                if (!error) {
		                    //custom verification, check that BeginDateO / EndDateO doesn't use DAY/MONTH/YEAR keywords
		                    if((params["BeginDateO"].includes("DAY") || params["BeginDateO"].includes("MONTH") ||
		                    	params["BeginDateO"].includes("YEAR")) || (params["EndDateO"].includes("DAY") ||
		                    	params["EndDateO"].includes("MONTH") || params["EndDateO"].includes("YEAR"))){
		                    	$("#export_custom_input_control").prop('disabled', true);
		                    	alert("BeginDateO / EndDateO ne peuvent pas utiliser les mots clés DAY/MONTH/YEAR !");
		                    }
		                    //if all custom verifications + jasper verifications are OK, update default input controls
		                    else{
		                    	$("#export_custom_input_control").prop('disabled', false);
			                    instance.custom_params = params;
			                    //store custom params inside the vizjs service to access it even after the destruction of the component
	          					instance.vizjsViewService.custom_params = instance.custom_params;
			                    console.log("no error in loading input control func, my params = "+ instance.custom_params);
		                    }
		                } else {
		                    $("#export_custom_input_control").prop('disabled', true);
		                    console.log("-----------------------------cant load input controls, error : "+error);
		                    //instance.drawResource_var_dict["my_params"] = undefined;
		                }
		            }
		        },
		        success: function (controls) {
					console.log("success load Jasper UI");
					//if params != undefined / null, update params to display user custom ic
					if(instance.custom_params !== undefined && instance.custom_params !== null){
						console.log("keep user defined params, params = "+instance.custom_params);
						console.log("print all parameters infos before the run");
			            for(var key in instance.custom_params){
			              console.log("key : "+key+" value : "+instance.custom_params[key] + " type of val : "+ typeof instance.custom_params[key] +
			               " properties : \n"+Object.getOwnPropertyNames(instance.custom_params[key][0]));
			            }
						
			            //var manual_params = {"BeginDateTimeO":["DAY-3"],"EndDateTimeO":["DAY-1"],"IC.activite":["91"],"BeginDateO":["2021-05-18"],"EndDateO":["2021-05-18"]};
						//update ic with new default params
			            instance.inputControls.params(instance.custom_params).run().done(function(){
			              console.log("input control update success, params valid = "+Object.getOwnPropertyNames(instance.inputControls.data().parameters)+"\nBeginDateTimeO : "+
			              	Object.getOwnPropertyNames(instance.inputControls.data().parameters["BeginDateTimeO"]) + " val : "+instance.inputControls.data().parameters["BeginDateTimeO"]);
			              //check new dict of params gived by the CSV file, if one input is not equal to ~NOHTING~ or undefined or "" the test is passed, else trigger error and reset custom params
			              var test_custom_params_from_file = false;
			              if(instance.verif_custom_params_from_file){
			              	for(var key in instance.inputControls.data().parameters){
			              		if(instance.inputControls.data().parameters[key] != "" && instance.inputControls.data().parameters[key] != undefined &&
			              		 instance.inputControls.data().parameters[key] !== null && instance.inputControls.data().parameters[key] != "~NOTHING~"){
			              			test_custom_params_from_file = true;
			              		}
			              	}
			              	if(test_custom_params_from_file == false){
			              		alert("Erreur lors de l\'utilisation des paramètres fournis dans le fichier CSV chargé, veuillez le reconfigurer. Reinitialisation des paramètres ...");
			              		instance.resetCustomInputControls();
			              	}
			              }
			              instance.verif_custom_params_from_file = false;
			              instance.vizjsViewService.verif_custom_params_from_file = false;
			            }).fail(function(error){
			              console.log("input control update failed : "+Object.getOwnPropertyNames(error) +"\nerror : "+error["message"]);
						  console.log("error details = " + Object.getOwnPropertyNames(error["parameters"]) + "\n code : " + error["errorCode"]);
						  alert("Erreur lors de l\'utilisation des paramètres que vous avez configuré dans le menu config, essayez de les modifier ou de revenir au mode classique");
			              instance.verif_custom_params_from_file = false;
			              instance.vizjsViewService.verif_custom_params_from_file = false;
			            });
					}
					//else, reinit params
					else{
						console.log("reinit params");
						//reset verif custom params from file
						instance.verif_custom_params_from_file = false;
						instance.vizjsViewService.verif_custom_params_from_file = false;
					}
		        },
		        error: function (error) {
		          console.log("error in get input control section : "+error);
		        }
		    });
	  	});
	}

	//submit data and update custom ic gived by jasper UI 
	resetCustomInputControls(){
		console.log("Custom input controls reset");
		//reset iinputControls
		this.inputControls.reset().done(function(){
        //instance.inputControls.params(manual_params).run().done(function(){  
          console.log("input control reset success");
        }).fail(function(error){
          console.log("input control reset failed : "+Object.getOwnPropertyNames(error) +"\nerror : "+error["message"]);
          alert("Erreur lors de la réinitialisation des paramètres par défaut : "+error);
        });
		this.vizjsViewService.custom_params = null;
		this.custom_params = this.vizjsViewService.custom_params;
	}

	//export custom params to a CSV file
	exportCustomParamsToCSV(){
		console.log("Exporting custom params to CSV");
		//function to get the csv string from the custom params Object
        function objectsToCSV(arr) {
		    const array = [Object.keys(arr[0])].concat(arr)
		    return array.map(row => {
		        return Object.values(row).map(value => {
		            return typeof value === 'string' ? JSON.stringify(value) : value
		        }).toString()
		    }).join('\n')
		}

		var csvStr = objectsToCSV([this.custom_params]);
		const filename = 'custom_params.csv';

		let element = document.createElement('a');
		element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(csvStr));
		element.setAttribute('download', filename);
		element.style.display = 'none';
		document.body.appendChild(element);
		element.click();
		document.body.removeChild(element);
	}

	//function which handle the drop of a custom params CSV file
	dropHandler(ev) {
	  console.log('File(s) dropped');
	  var custom_params = {};
	  // Prevent default behavior (Prevent file from being opened)
	  ev.preventDefault();

	  console.log("ev struct : "+Object.getOwnPropertyNames(ev));
	  console.log("\nev handleObj : "+Object.getOwnPropertyNames(ev["handleObj"])+"\n data : "+ev["handleObj"]["data"]);
	  console.log("\nev data : "+ev["data"]);
	  console.log(ev.originalEvent.dataTransfer.files[0]);

	  const file = ev.originalEvent.dataTransfer.files[0];
	  const fileReader = new FileReader();

	  fileReader.readAsText(file);

	  fileReader.onload = function() {
	  	const dataset = fileReader.result;
	    const result = (<string>dataset).split('\n').map(data => data.split(','));

	    console.log(result);
	    console.log("result 0 0 : "+result[0][0]);
	    console.log("result 1 0 : "+result[1][0]);
	    for(var i = 0; i < result[0].length; i++){
    		custom_params[result[0][i].substring(1, result[0][i].length-1)] =  [result[1][i]];
	    }

	  };

	  	console.log("Custom params from file : ");
	    for(var key in custom_params){
	    	console.log("key : "+key+" value : "+custom_params[key] + " type of val : "+ typeof custom_params[key] + " properties : \n"+
	    		Object.getOwnPropertyNames(custom_params[key][0]));
	    }
	    var instance = this;
	    //test auto, no validation
	    instance.custom_params = custom_params;
        //store custom params inside the vizjs service to access it even after the destruction of the component
        instance.vizjsViewService.custom_params = instance.custom_params;
        //update a global param to force custom verifications in the JasperUI func 
        instance.verif_custom_params_from_file = true;
        instance.vizjsViewService.verif_custom_params_from_file = true;
        //refresh display
        instance.zone.run(() => {
          	instance.router.navigateByUrl('/', {skipLocationChange: true}).then(()=>
   			instance.router.navigate(["/vizjs-config"]));
          	//instance.router.navigate(['/vizjs-config'], {skipLocationChange: true});
        });
	}

	//function to prevent default cancel openning of the custom_params CSV file
	dragOverHandler(ev) {
	  console.log('File(s) in drop zone');

	  // Prevent default behavior (Prevent file from being opened)
	  ev.preventDefault();
	}

}