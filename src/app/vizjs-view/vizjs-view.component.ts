import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { VizjsViewService } from '../services/vizjs-view.services';
import { AuthService } from '../services/auth.services';
import { NgForm } from '@angular/forms';
import { Router } from '@angular/router';

declare var $: any;
declare var visualize: any;

@Component({
  selector: 'app-vizjs-view',
  templateUrl: './vizjs-view.component.html',
  styleUrls: ['./vizjs-view.component.scss']
})
export class VizjsViewComponent implements OnInit, OnDestroy {
  //variable to display message when 0 resources are found
  empty = false;
  //variable to store folders when we choose custom search mode
  my_custom_search_folders = [];
  //Usefull variables to display and manipulate visualizeJS resources
  folder_choice = "";
  list_folder_uri = [];
  list_resources_uri = [];
  list_resources_types = [];
  list_resources_labels = [];
  first_resource_data = [];
  resources_viewed = 0;
  timeout_number = 30000;
  container_size = Math.round($(window).height() * 0.80);
  vizjs_view_timeouts = [];
  custom_search_in_report = "";
  custom_search_parameters_in_report = [false, false];
  custom_search_usefull_data = []; //pages + hint count for "search_criteria"
  custom_search_pagination_index = 0;
  //dict of variables used in the "drawResource" function, mainly concernes vizJS
  drawResource_var_dict = {};
  //formats of exports allowrd for reports (can be change to report.exportFomats if there are different exports between reports)
  report_export_formats = ["pdf","xlsx","xls","rtf","csv","xml","odt","ods","docx","pptx","json"];
  //dict which contains all customized default values of several inputControls
  custom_params = null;

  constructor(private authService: AuthService, private vizjsViewService: VizjsViewService, private router: Router, private zone: NgZone) { }

  //function which will be triggered when the component is created
  //1) Get usefull values in variables, 2) Update HTML, 3) Drfaw the resource
  ngOnInit() {
	  console.log("ngOnInit func");
    //stock instance to use it later in functions
    var instance = this;
    //trigger disconnection if the user is on this page too much time  ==> 1st iteration, will be recreate on each user action
    instance.vizjs_view_timeouts.push(setTimeout(function() {
      console.log("timeout function vizjs-view");
      console.log("you stayed too much time inactive on the vizjs-view page, disconnection");
      alert("Vous êtes restés trop longtemps inactif sur la page, deconnexion");
      //sign out
      instance.authService.signOut();
      instance.zone.run(() => {
          instance.router.navigate(['/auth']);
      });
    }, instance.authService.inactive_timeout, instance));

    console.log("screen size ==> "+$(window).height()+" container size will be "+this.container_size);
    //set the initial size of the resource container in HTML view
    $("#resource_container").css("height", this.container_size+"px");

  	//get resources informations
  	var resources_informations;

    console.log("time to init vizjs view");
    this.folder_choice = this.vizjsViewService.getFolderChoice();

    //get the dict of custom input control values from vizjsViewService
    this.custom_params = this.vizjsViewService.custom_params;

    //use different getter of informations depending on the customSearch var (maybe temporary behaviour
    if(this.vizjsViewService.custom_search_activate == false){
    	console.log("get resource informations");
      this.vizjsViewService.getResourcesInformation(
    		this.folder_choice, this.authService.getUsername(), this.authService.getPassword()
    	).then(
    		success => {
    			console.log("get resource information successfull !");// => "+success);
    			
          //check if success is empty, if it's the case print an error message and exit
          if(success[0] === undefined){
              //console.log("success 0 : |"+success[0]+"| get props : "+Object.getOwnPropertyNames(success));
              //trigger click event
            alert("Le dossier source est vide ! (ou vous n\'avez pas les permissions nécessaires pour y accéder)\nAucune ressource visualize JS disponible, vous devriez modifier le dossier source dans le menu de configuration");
            //navigate to the config page
            this.zone.run(() => {
                this.router.navigate(['vizjs-config']);
            });
          }

          this.vizjsViewService.resources_informations = success;
    			resources_informations = this.vizjsViewService.resources_informations;

    			//init vizjs variables (first resource, first resouce type, array with resource data, ...)
    			this.initVizjsVariables(resources_informations, this.folder_choice, this.vizjsViewService.custom_search_activate);
    			
    			//build the select element with all available resources (hard to add other HTML functions here,
    			// nearly evering needs to be configured inside the "drawResource" function via viusalizeJS events)
    			this.buildResourceSelectControl(this.folder_choice);

    			//Use visjz to load the report / dashboard view + all side features (onclick, input controls, zoom, ...)
    			this.drawResource(this, this.authService.getUsername(), this.authService.getPassword(), this.first_resource_data, this.folder_choice);
    		},
    		error => {
    			console.log("get resource information failed !");
    		}

    	);
    }else{
      //we had some steps if the custom search is activated
      //first get folder information
      this.vizjsViewService.getFoldersInformation(
        this.folder_choice, this.authService.getUsername(), this.authService.getPassword()
      ).then(
        success => {
          //print results
          console.log("Get folder information successfull ! => "+success);
          this.vizjsViewService.resources_informations = success;
          resources_informations = this.vizjsViewService.resources_informations;
          
          //stock folders in a var
          resources_informations.reduce(function (list, option) {
            console.log(`${option.label}`);
            instance.my_custom_search_folders.push(option.uri);
          }, "");

          //if we have folders infos, start another promise to get resources informations 
          // + trigger all steps to draw the resource
          this.vizjsViewService.getResourcesInformationCustomSearch(
            this.folder_choice, this.vizjsViewService.search_query, this.vizjsViewService.resources_types_custom_search,
             this.authService.getUsername(), this.authService.getPassword()).then(
              success => {
                console.log("Get resources informations after folders infos successfull ! => "+success);
                //use global var to store resources
                this.vizjsViewService.resources_informations = success;
                resources_informations = this.vizjsViewService.resources_informations;

                //init vizjs variables WITH SPECIFIC PARAMETER (first resource, first resouce type, array with resource data, ...)
                this.initVizjsVariables(resources_informations, this.folder_choice, this.vizjsViewService.custom_search_activate);
                
                //check if 0 resources are found, if it's the case go to view (special error msg)
                if(this.list_resources_uri.length == 0){
                  alert("Aucune ressource disponible avec vos critères de recherche, veuillez modifier vos options en cliquant sur l'onglet"+
                  "<configuration>");
                  this.empty = true;
                }else{
                  this.empty = false;
                  //build the select element with all available resources (hard to add other HTML functions here,
                  // nearly evering needs to be configured inside the "drawResource" function via viusalizeJS events)
                  this.buildResourceSelectControl(this.folder_choice);

                  //Use visjz to load the report / dashboard view + all side features (onclick, input controls, zoom, ...)
                  this.drawResource(this, this.authService.getUsername(), this.authService.getPassword(), this.first_resource_data, this.folder_choice);
                }
              },
              error => {
                console.log("get resources informations after folders infos failed");
              }
            );
        },
        error => {
          console.log("get folder information failed")
        }
      );
    }
  }

  //function which will be triggered when the component is destroyed
  //here we just destroy all timeouts created
  ngOnDestroy(){
    console.log("destroy vizjs-view component");
    this.destroyTimeouts();
  }

  //function to destroy all timeouts
  destroyTimeouts(){
    console.log("destroy all timeouts of vizjs-config component");
    //clear all active "set time out" functions
    for(var i=0; i < this.vizjs_view_timeouts.length; i++){
      clearTimeout(this.vizjs_view_timeouts[i]);
    }
    this.vizjs_view_timeouts = [];  
  }

  //function to "recreate" a setTimeOut to disconnect the user if he is inactive
  recreateInactiveTimeout(instance){
    console.log("recreate inactive timeout");
    instance.destroyTimeouts();
    instance.vizjs_view_timeouts.push(setTimeout(function() {
      console.log("timeout function vizjs-view");
      console.log("you stayed too much time inactive on the vizjs-view page, disconnection");
      $('#exampleModal').modal('hide'); //avoid display bug
      alert("Vous êtes restés trop longtemps inactif sur la page, deconnexion");
      //sign out
      instance.authService.signOut();
      instance.zone.run(() => {
          instance.router.navigate(['/auth']);
      });
    }, instance.authService.inactive_timeout));

  }


  ////FUNCTIONS TO UPDATE HTML VIEW////

  // Get all resource of the specified folder and put them in a select element
  buildResourceSelectControl(folder_choice) {
      console.log("buildResourceSelectControl function, folder choice "+folder_choice);
      //sort resources
      var current_resource_uri = "";
      var final_list = "";
      var folder_color = "";

      for (var i = 0; i < this.list_folder_uri.length; i++) {
          //get color of folder element
          folder_color = this.getFolderColor(folder_choice, this.list_folder_uri[i]);
          //create folder option element
          final_list += "<option disabled style='background-color:" + folder_color + " ; color:white;'>"
              + this.list_folder_uri[i].split("/").pop() + "</option>";

          for (var y = 0; y < this.list_resources_uri.length; y++) {
              //modify current resource uri to classify the resource 
              current_resource_uri = this.list_resources_uri[y].split("/").slice(0,-1).join("/");

              //Create uri_resource html code in the good order (valid folder)
              if (current_resource_uri == this.list_folder_uri[i]) {
                  //console.log("uri base " + i + " is in resource " + y + " " + this.list_resources_uri[y]);
                  if (this.list_resources_types[y] == "reportUnit") {
                      final_list += "<option name=" + this.list_resources_types[y] + " value=" + this.list_resources_uri[y] + ">📋 " + this.list_resources_labels[y] + "</option>"
                  } else if (this.list_resources_types[y] == "adhocDataView"){
                      final_list += "<option name=" + this.list_resources_types[y] + " value=" + this.list_resources_uri[y] + ">👁️ " + this.list_resources_labels[y] + "</option>"
                  } else {
                      final_list += "<option name=" + this.list_resources_types[y] + " value=" + this.list_resources_uri[y] + ">📊 " + this.list_resources_labels[y] + "</option>"
                  }
              }
          }
      }

      // Change existing elements (select element from view and label)
      console.log("Select element ready, change the HTML view");
      var my_label = document.getElementById("label_resource_selection");
      my_label.innerHTML = "Ressources du dossier <b title=" + folder_choice + ">" + folder_choice.split("/").pop() + "</b> : ";

      var my_select = document.getElementById("resource_selection");
      my_select.innerHTML = final_list;
  }

  //Get correct color for folder resource (based on the "level" of the folder in the repo)
  getFolderColor(original_folder, current_folder, colors_array = ["brown", "blue", "red",
      "orange", "purple", "green", "grey"]) {
      console.log("getFolderColor func");
      var current_size = current_folder.split("/").length;
      var original_size = original_folder.split("/").length;
      var color_size = colors_array.length;

      //if there are more sub folders than colors available, color with the first color
      if ((current_size - original_size) >= color_size) {
          return colors_array[0];
      } else {
          return colors_array[current_size - original_size];
      }
  }

  // Init the HTML view (depending on folder_choice variable, if it is set, show buttons)
  initView(is_set) {
    if (is_set == true) {
        console.log("Initview OK, display HTML elements");
        //show resource selection
        $("#resource_selection").css("display", "block");
        $("#label_resource_selection").css("display", "block");
        //hide auth
        $("#authentication_jasper").css("display", "none");
    } else {
        console.log("InitView don't have the folder choice var, error");
        //hide resource selection
        $("#resource_selection").css("display", "none");
        $("#label_resource_selection").css("display", "none");
        //show auth auth
        $("#authentication_jasper").css("display", "block");
    }
  }

  //Hide / show report HTML elements (if resource == dashboard, hide feature toolbar)
  hideOrShowReportHTMLElements(hide) {
	    console.log("hideOrShowReportHTMLElements func");
      if (hide) {
          //fixed bar
	        $("#hide_fix_bar").css("display", "none");
          $(".feature_btn").prop("disabled", true);
	        //select container for dashboard
	        $("#resource_container").css("display", "block"); //was none before
	    } else {
          //fixed bar
          $("#hide_fix_bar").css("display", "block");
          $(".feature_btn").prop("disabled", true);
	        //select container for report
	        $("#resource_container").css("display", "block");
	        //resize report to original size
	        $("#resource_container").css("height", this.container_size+"px");
	        //update page num
	        //$("#page_label").html("page 1 :");
	        //update % of zoom
	        $("#zoom_custom_label").html("Zoom 100% :");
	    }
  }

  //Creation of the export "<select>" element 
  buildControl(name, options) {
    console.log("buildControl func");
    //function to create our options with the data provided (simple replace)
    function buildOptions(options) {
        var template = "<option>{value}</option>";
        return options.reduce(function (memo, option) {
            return memo + template.replace("{value}", option);
        }, "")
    }

    //create a select element with all informations neeeded
    var template = "<label id='export_resource_label' class='col-form-label'>{label}</label><select id='export_resource_select' class='custom-select col-lg-4'>{options}</select><br>",
        content = template.replace("{label}", name)
            .replace("{options}", buildOptions(options));

    var dollar_control = $(content);
    dollar_control.insertBefore($("#export_button"));
    return $(dollar_control[1]);
  }

  // function to avoid utf8 problem when calling the rest API (first resource uri var can have wrong enconding => 
  // /L4_logistics/Conception/rapports_test/copy_reports/FACSMB1__Synth&#232;se_Pr&#233;paration)
  clean_utf8(current_folder_name) {
    console.log("clean utf8 func");
    var correct_folder_name = "";
    var clean_mode = 0;
    var char_number = "";

    //replace special character in the name of the folder with the good letter
    for (var i = 0; i < current_folder_name.length; i++) {

        if (clean_mode == 1 || current_folder_name[i] == "&") {
            clean_mode = 1;
            if (current_folder_name[i] >= '0' && current_folder_name[i] <= '9') {
                // it is a number, stock it in char_number
                char_number += current_folder_name[i];
            }

            if (current_folder_name[i] == ";") {
                // it's the end of the utf8 char, need to convert and insert into correct_folder_name
                correct_folder_name += String.fromCharCode(parseInt(char_number));
                // reset vars
                char_number = "";
                clean_mode = 0;
            }

        } else {
            correct_folder_name += current_folder_name[i];
        }
    }

    return correct_folder_name;
  }

  //check if a word is inside a box of the report (and is matching user parameters), if it's the case update the css 
  customSearchInReport(spans){
    console.log("custom search to highlight user search word inside a report with specific options");
    var instance = this;
    spans.each(function(i, e){

      //var to stock the text of the box
      var box_content = e.innerHTML.replaceAll("<br>", "");
      //console.log("box content : "+box_content);

      //BUG : Handle temporary => delete element when there is a </span> tag and warn with console
      if(box_content.includes("</span>")){
        console.log("TEMPORARY BUG WITH SEARCH (SPANS WHEN USING INPUT CONTROLS), REMOVE");
        return true;
      } 
      
      //first, check if the "complete words" option is activated, if it's the case, the search criteria
      //must start at the beginning of the text OR have a whitespace behind ==> begin conditions
      //AND must finish with the end of the text OR have a whitespace at the end ==> end conditions

      //example text => Thu Aug 24    | example search criteria = Thu au === NOT GOOD (no END / whitespace at the end)
      //example text => Thu Aug 24    | example search criteria = Aug 24 === GOOD

      var begin_conditons = false;
      var end_conditions = false;

      if(instance.custom_search_parameters_in_report[1] == true){
        //first check if the search criteria exist as a substring
        var index_of_complete_words = box_content.toLowerCase().indexOf(instance.custom_search_in_report.toLowerCase());
        if(index_of_complete_words != -1){
          //if it's the case, check that (the index is equal to 0 OR index-1 contains a whitespace)
          // AND that (index + length is equal to END(box_content.length) OR index + len contains a whitespace)

          //test begin_conditons
          if(index_of_complete_words == 0){
            begin_conditons = true;
          }else if(box_content[index_of_complete_words-1] == " "){
            begin_conditons = true;
          }

          //test end_conditions
          if(index_of_complete_words + instance.custom_search_in_report.length == box_content.length){
            end_conditions = true;
          }else if(box_content[index_of_complete_words + instance.custom_search_in_report.length] == " "){
            end_conditions = true;
          }

          //if begin and end condtions are equal to true, we can go to the next steps
          //if not, return to exit the function
          if(begin_conditons == false || end_conditions == false){
            console.log("complete words conditions == NOT OK");
            return;
          }else{
            console.log("complete words conditions == OK");
            return;
          }
        }
      }

      //then, apply processing (highlight specific elem) on the whole report box
      //store the search condition (apply case sensitivity or not) based on custom parameters[0]
      var search_condition = false;
      var search_criteria_index = -1;
      var keep_br_positions = [];
      //Execute specific search depending on the parameters provided ([0] = case sensitive and [1] = words only)
      if(instance.custom_search_parameters_in_report[0] == true){
        
        search_condition = (instance.custom_search_in_report != "" && 
          box_content.includes(instance.custom_search_in_report));
        search_criteria_index = box_content.indexOf(instance.custom_search_in_report);
      }else{
        search_condition = (instance.custom_search_in_report != "" && 
          box_content.toLowerCase().includes(instance.custom_search_in_report.toLowerCase()));
          search_criteria_index = box_content.toLowerCase().indexOf(instance.custom_search_in_report.toLowerCase());
      }
      // make them blue if custom_search_in_report != "" and is included in the elem
      if(search_condition != false){

        //Get indexes to make the highlight paragraph, we already have the search criteria index
        var highlight_indexes = [];
        //get last index of whitespace between BEGIN - first index search
        highlight_indexes.push(box_content.substring(0, search_criteria_index).lastIndexOf(" "));
        //get first index of whitespace between (first index + len) - END
        highlight_indexes.push(box_content.substring(search_criteria_index + instance.custom_search_in_report.length, box_content.length).indexOf(" "));

        //if no whitespace were detected, replace values
        if(highlight_indexes[0] == -1){
          highlight_indexes[0] = 0;
        }else{
          highlight_indexes[0] += 1;
        }
        if(highlight_indexes[1] == -1){
          highlight_indexes[1] = box_content.length;
        }else{
          highlight_indexes[1] += search_criteria_index + instance.custom_search_in_report.length;
        }

        //log to check that all paragraphs are OK
        // console.log("All indexes : search cond => "+search_criteria_index+" high 1 => "+highlight_indexes[0]+" high 2 => "+highlight_indexes[1]);
         console.log("BEGIN paragraph =|"+box_content.substring(0,highlight_indexes[0])+"|"
           +"Paragraph final==|"+box_content.substring(highlight_indexes[0], highlight_indexes[1])+"|"
           +" END paragraph =|"+box_content.substring(highlight_indexes[1], box_content.length)+"|");

        //store all paragraph content (parag BEGIN, parag SEARCH_WORD, parag END) into an array
        //(it will be modified if there are <br> in the text)
        var parag_content_array = [];
        parag_content_array.push(box_content.substring(0,highlight_indexes[0]));
        parag_content_array.push(box_content.substring(highlight_indexes[0], highlight_indexes[1]));
        parag_content_array.push(box_content.substring(highlight_indexes[1], box_content.length));

        //create a special string to include <br> tags
        var string_waiting_for_br = box_content.substring(0,highlight_indexes[0])+"¤"
          + box_content.substring(highlight_indexes[0], highlight_indexes[1])+"¤"
          + box_content.substring(highlight_indexes[1], box_content.length);

        //find all br positions
        function find_br_indexes(source, find) {
          var result = [];
          //number to substract to have the true position, mandatory because we have replace "<br>"" by "" 
          var substract_br = 0;
          for (i = 0; i < source.length; ++i) {
            // If you want to search case insensitive use 
            // if (source.substring(i, i + find.length).toLowerCase() == find) {
            if (source.substring(i, i + find.length) == find) {
              result.push(i - substract_br);
              console.log("br index "+(i-substract_br));
              substract_br += find.length;
            }
          }
          return result;
        }

        keep_br_positions = find_br_indexes(e.innerHTML, "<br>");

        //vars to save indexes, we use them to insert br without destroying the sentence for later
        var br_iterator = 0;
        var true_index = 0;
        for(i = 0; i < string_waiting_for_br.length; i++){
          //if all br have been inserted, update paragraph content array and leave
          if(br_iterator == keep_br_positions.length){
            //console.log("break insert br");
            parag_content_array = string_waiting_for_br.split("¤");
            break;
          }
          //when we have the special character, do not count it
          if(string_waiting_for_br[i] == "¤"){
            //console.log("not count, go next");
            continue;
          }
          //insert br when we are at the good index
          if(true_index == keep_br_positions[br_iterator]){
            string_waiting_for_br = string_waiting_for_br.substring(0, i) + "<br>" + string_waiting_for_br.substring(i);
            i+=4;
            br_iterator += 1;
          }
          true_index += 1;
        }

        console.log("final br sentence : "+parag_content_array.join(""));

        //Put Begin paragraph in a <p> elt, then paragraph final in another special <p> elt, finally End paragraph in the 1st <p> elt
        var tempo_innerHTML = "";
        tempo_innerHTML += "<p style='display: inline;'>"+parag_content_array[0];
        tempo_innerHTML += "<i style='display: inline; font-style: normal; background-color: #AFEEEE;'>"+parag_content_array[1]+"</i>";
        tempo_innerHTML += parag_content_array[2] + "</p>";

        //update HTML element
        e.innerHTML = tempo_innerHTML;
      }
      return '';
    });                     
  }

  //FUNCTIONS RELATED TO VISUALIZEJS INITIALIZATION (GET RESOURCES INFORMATION) 

  //function used during the initialisation of visiualizeJS (sort folders found in the "folder_source" => display like Jasper server) 
  sortFolders(folder_uri, final_folder_list){
      console.log("sort folder function");
      var leave_while = 0;
      var global_counter = -1;
      
      var source = final_folder_list.slice(-1)[0];
      //console.log("own property of source : "+Object.getOwnPropertyNames(source));
      var len_source;
      len_source = source.split("/").length;
      var breaker = 0;
      
      while(leave_while == 0 && global_counter < 500){  
        global_counter += 1;
        breaker = 0;
        
        //Check all available folder, first which is len + 1 can be add + pop + change source
        for(var a = 0; a < folder_uri.length; a++){
          //console.log("loop "+a+" folder uri a type => "+typeof folder_uri[a]+" folder uri len => "+folder_uri.length);
          if(folder_uri[a].includes(source) && folder_uri[a].split("/").length > len_source){
              final_folder_list.push(folder_uri[a]);
              folder_uri.splice(a,1);
              //console.log("f is "+folder_uri[a]+"2nd test : folder uri len => "+folder_uri.length);
              source = final_folder_list.slice(-1)[0];
              len_source = source.split("/").length;
              breaker = 1;
              break;
          }
        }

        //if no len + 1 was found
        if(breaker == 0){
          //console.log("time to go back");
          global_counter += 1;
          
          //determine new usefull source, 1st check ega, then minus 1
          var usefull_source = 0;
          var usefull_source_count = 0;
          while(usefull_source == 0 && usefull_source_count < 500 && folder_uri.length > 0){
            for(var s = 0; s < folder_uri.length; s++){
              //check if there is a folder len == len_source, if it's the case change
              if(folder_uri[s].split("/").length == len_source){
                final_folder_list.push(folder_uri[s]);
                folder_uri.splice(s,1);
                source = folder_uri[s];
                usefull_source = 1;
                break;
              }
            }
            //no folder == len_source, minus by 1 and continue the search
            //console.log("USEFULL SOURCE = "+usefull_source);
            if(usefull_source != 1){
              usefull_source_count += 1;
              len_source -= 1;
            }

            //if folder uri is empty, end of while
            if(folder_uri.length == 0){
              leave_while = 1;
            }
          } 
          //console.log("new usefull source == "+source);
        }
      }
      //console.log("END OF SORT FOLDER WHILE, global_counter = "+global_counter);
      return final_folder_list;
      
      //if folder uri != len + 1 with pop / (compared to final[number]), return
      //if final_folder_list is empty, push first ressource
  }

  //transform information of API to store them in variables
  initVizjsVariables(resources_informations, folder_choice, custom_search_activate){
  	console.log("init JS variables function");
    var list_folder_uri = [];
    var list_resources_types = [];
    var list_resources_labels = [];
    var list_resources_uri = [];

    //This variable will be transfered to display the first resource when the page is loading 
    //(on resfresh / first visit of the web page)
    var first_resource_data = [];

    //if custom search is not activated, start to fill list_folder_uri, if it is activated, assign var
    if(custom_search_activate == false){
      list_folder_uri.push(folder_choice);
    }else{
      list_folder_uri = this.my_custom_search_folders;
    }
    const resourceNames = resources_informations.reduce(function (list, option) {
        //check new uri pattern ?
        if (!list_folder_uri.includes(option.uri) && option.resourceType == "folder") {
            //console.log("add new uri " + option.uri);
            list_folder_uri.push(option.uri);
        }

        if (option.resourceType != "folder") {
            //fill resource arrays
            list_resources_types.push(option.resourceType);
            list_resources_labels.push(option.label);
            list_resources_uri.push(option.uri);
        }

	  }, "");

    //sort folders + find first resource, init vars
    var current_resource_uri;
    var final_folder_list = [];
    var tempo_folder_uri = list_folder_uri;

    //first push and first pop
    final_folder_list.push(tempo_folder_uri[0]);
    tempo_folder_uri.splice(0, 1); 


    // //check state of tempo array before sortFolders func (for debug)
    // for(var t = 0; t < tempo_folder_uri.length;t++){
    //   console.log("tempo elm "+t+" = "+tempo_folder_uri[t]);
    // }

    final_folder_list = this.sortFolders(tempo_folder_uri, final_folder_list);
    console.log("folders should be sorted now");
    //console.log("end");

    // debug ==> iterate through tempo and final folder

    list_folder_uri = final_folder_list;

    //Sort classic resources

    //counter variable, if it's value is 0, we can add first resource data to the first_resource_data var
    var counter = 0;

    for (var i = 0; i < list_folder_uri.length; i++) {
        //console.log("elem " + i + "\n");

        for (var y = 0; y < list_resources_uri.length; y++) {
            //modify current resource uri to classify the resource 
            current_resource_uri = list_resources_uri[y].split("/").slice(0,-1).join("/");
            if (current_resource_uri == list_folder_uri[i]){
                //if counter == 0, get data
                if(counter == 0){
                    first_resource_data.push(list_resources_uri[y]);
                    first_resource_data.push(list_resources_types[y]);
                }
                counter += 1;
            }
        }
    }
  	//update global vars
    this.list_folder_uri = list_folder_uri;
  	this.list_resources_uri = list_resources_uri;
  	this.list_resources_types = list_resources_types;
  	this.list_resources_labels = list_resources_labels;
  	this.first_resource_data = first_resource_data;

  	//Some logs to verify vars
    console.log("check VARS : ");
  	console.log("list folder uri "+list_folder_uri);
  	console.log("list_resources_uri "+list_resources_uri);
  	// console.log("list_resources_types "+list_resources_types);
  	// console.log("list_resources_labels "+list_resources_labels);
  	console.log("first_resource_data "+first_resource_data);
  }

  //// FUNCTIONS RELATED TO VISUALIZEJS RESOURCES (CONFIG + DRAWRESOURCE)

  //function to init the HTML view (with other functions) and vars that will be used by visualizeJS
  initHTMLViewAndVariables(instance, first_resource_data){
      //function used to avoid timeout, creating 10/15 min 
      instance.recreateInactiveTimeout(instance);
      //functions to init the HTML view
      instance.hideOrShowReportHTMLElements(false);
      instance.initView(true);
      $("#error_message").html("");
      // //activate loader + cancel button
      $("#loading_resource").css("display", "block");
      //var to force the disconnection when on change is triggered after a long period of inactivity
      $('#exampleModal').modal('hide');

      //clean resource uri
      first_resource_data[0] = instance.clean_utf8(first_resource_data[0]);

      //create the drawResource dict which will contain all variables that are updated often 
      
      //var to avoid alert message if a manual cancel is triggered
      //cancel = 0 => normal, cancel = 1 => manual cancel, cancel = 2 => user has clicked on another page, destroy resource
      instance.drawResource_var_dict["cancel"] = 0;
      instance.drawResource_var_dict["my_params"] = undefined;
      instance.drawResource_var_dict["totalPages"] = 0;
      instance.drawResource_var_dict["currentPage"] = 1;
      instance.drawResource_var_dict["current_resource_type"] = "";
      //var used to force search when a user use search mode in a "input control" modified report 
      instance.drawResource_var_dict["activate_search_for_input_controls"] = 0;
      //init resources types with undefined
      instance.drawResource_var_dict["adhocView"] = undefined;
      instance.drawResource_var_dict["dashboard"] = undefined;
      instance.drawResource_var_dict["report"] = undefined;
      instance.drawResource_var_dict["inputControls"] = undefined;
      //name + type of current ressource
      instance.drawResource_var_dict["first_resource_data"] = first_resource_data; 
  }

  //function to reinitialize vars and destroy old resource when the user run another resource
  onChangeReinit(instance){
      $("#submit_input_control").prop('disabled', true);
      instance.drawResource_var_dict["cancel"] = 0;
      instance.drawResource_var_dict["activate_search_for_input_controls"] = 0;
      //init params to error, avoid running report with same parameters
      instance.drawResource_var_dict["my_params"] = undefined;
      $("#loading_resource").css("display", "block");
      $("#error_message").html("");
      //this code recreate a new timeout to avoid disconnection, it is mainly use when a new resource is created
      instance.drawResource_var_dict["cancel"] < 2 ? instance.recreateInactiveTimeout(instance) : console.log("");
      //cancel current resource
      if(instance.drawResource_var_dict["current_resource_type"] == ""){
        console.log("first iteration, no need to destroy");
      }
      else if(instance.drawResource_var_dict["current_resource_type"] == "report"){
        console.log("cancel report");
        //check if we are creating the same report (with different parameter for example)
        //if it's not the case, reset report search parameters
        if(instance.drawResource_var_dict["first_resource_data"][0] != $("#resource_selection").val()){
          console.log("reset report search parameters");
          //reset val of search query and option checkboxes
          $("#search-query").val("");
          $("#case_sensitive_search").prop('checked', false);
          $("#case_sensitive_search_icon").css('color', "red");
          $("#word_only_search").prop('checked', false);
          $("#word_only_search_icon").css("color", "red");
          
          //update custom search word and search parameters
          instance.custom_search_in_report = "";
          instance.custom_search_parameters_in_report = [false, false];
          instance.custom_search_usefull_data = "";

          //hide custom word search occurences by pages button
          $("#searchNavigationModal-button").css("display", "none");

        }
        instance.drawResource_var_dict["report"].destroy().fail(function() {  });
      }else if(instance.drawResource_var_dict["current_resource_type"] == "dashboard"){
        console.log("cancel dashboard");
        instance.drawResource_var_dict["dashboard"].destroy();
      }else{
        console.log("cancel adhocView");
        instance.drawResource_var_dict["adhocView"].destroy();
      }

      //update current resource informations
      console.log("ON CHANGE current resource");
      instance.drawResource_var_dict["first_resource_data"][0] = $("#resource_selection").val();
      instance.drawResource_var_dict["first_resource_data"][1] = $("#resource_selection").find('option:selected').attr("name");
      console.log("--new cur res = " + instance.drawResource_var_dict["first_resource_data"][0] + " type : " + instance.drawResource_var_dict["first_resource_data"][1]);
  }

  //function that will configure the dashboard (options, generation events, HTML container to provide, ...)
  configDashboard(instance, v){
      instance.drawResource_var_dict["current_resource_type"] = "dashboard";
      console.log("dashboard rendering");
      instance.hideOrShowReportHTMLElements(true);
      instance.drawResource_var_dict["dashboard"] = v.dashboard({
          resource: instance.drawResource_var_dict["first_resource_data"][0],
          container: "#resource_container",
          success: function () {
              //deactivate loader + cancel button
              $("#loading_resource").css("display", "none");
              instance.drawResource_var_dict["cancel"] < 2 ? instance.recreateInactiveTimeout(instance) : console.log("");
              console.log("dashboard successfull");
              //hideOrShowReportHTMLElements(true);
          },
          error: function (error) {
              //deactivate loader + cancel button
              $("#loading_resource").css("display", "none");
              instance.drawResource_var_dict["cancel"] < 2 ? instance.recreateInactiveTimeout(instance) : console.log("");
              console.log("dashboard error : "+error);
          }
      });
  }

  //function that will configure the adhoc View (options, generation events, HTML container to provide, ...)
  configAdhocView(instance, v){
      instance.drawResource_var_dict["current_resource_type"] = "adhocDataView";
      console.log("adhocView rendering");
      instance.hideOrShowReportHTMLElements(true);
      instance.drawResource_var_dict["adhocView"] = v.adhocView({
          resource: instance.drawResource_var_dict["first_resource_data"][0],
          container: "#resource_container",
          success: function () {
              //deactivate loader + cancel button
              $("#loading_resource").css("display", "none");
              instance.drawResource_var_dict["cancel"] < 2 ? instance.recreateInactiveTimeout(instance) : console.log("");
              console.log("adhocView loaded");
          },
          error: function (error) {
              //deactivate loader + cancel button
              $("#loading_resource").css("display", "none");
              instance.drawResource_var_dict["cancel"] < 2 ? instance.recreateInactiveTimeout(instance) : console.log("");
              console.log(error);
          }
      });
  }

  //function that will configure report (options, generation events, HTML container to provide, ...)
  configReport(instance, v, folder_choice){
    instance.drawResource_var_dict["current_resource_type"] = "report";
    console.log("report rendering");
    //render report from provided resource, display some HTML elements (report toolbar)
    instance.hideOrShowReportHTMLElements(false);
    instance.drawResource_var_dict["report"] = v.report({
        resource: instance.drawResource_var_dict["first_resource_data"][0],
        runImmediately: false,
        container: "#resource_container",
        //uncomment to change default behaviour²
        scale: "height",//width|height|1|container
        //autoresize: false,
        scrollToTop: true,
        //option to modifiy link elements
        // linkOptions: {
        //     beforeRender: function (linkToElemPairs) {
        //       linkToElemPairs.forEach(function (pair) {
        //           var el = pair.element;
        //           console.log("el : "+el);
        //           el.style.backgroundColor = "red";
        //       });
        //     }
        // },
        events: {
            beforeRender: function (el) {
                console.log("------BEFORE RENDERING");
                console.log("folder choice "+folder_choice+" first ressource = "+instance.drawResource_var_dict["first_resource_data"][0]);
                // find all spans + custom search if research is activated
                var spans;
                if(instance.custom_search_in_report != ""){
                  spans = $(el).find(".jrPage td span");
                  //call the function to apply a specific search + css modifications
                  instance.customSearchInReport(spans);
                }
                
            },
            reportCompleted: function (status) {
                //deactivate loader + cancel button
                $("#loading_resource").css("display", "none");
                instance.drawResource_var_dict["cancel"] < 2 ? instance.recreateInactiveTimeout(instance) : console.log("");
                console.log("----------Report status: " + status + "!");
                if (status == "ready") {
                    //display report features
                    console.log("TIME TO DISPLAY BLOCK");
                    $("#hide_fix_bar").css("display", "block");

                    $('#ic').trigger('change');
                } else {
                    //if everything is ok, display report features, if not hide them
                    console.log("HIDE => status != ready ====> " + status);
                    $("#hide_fix_bar").css("display", "block");
                    //$("#hide_fix_bar").css("display", "none");
                    //$("#ic").html("Erreur lors du chargement des contrôles d'entrées, le rapport n'est pas utilisable");
                }
            },
            changeTotalPages: function (total) {
                instance.drawResource_var_dict["totalPages"] = total;
                console.log("Total Pages:" + instance.drawResource_var_dict["totalPages"]);
                $("#page_label").html("page 1 / " + instance.drawResource_var_dict["totalPages"] + " :");

                //If total pages == 0, the report is either empty or one mandatory parameter is not set,
                //warn the user with an alert element
                console.log("V2 TOTAL PAGES == "+instance.drawResource_var_dict["totalPages"]);
                if(instance.drawResource_var_dict["totalPages"] == 0){
                    alert("Le rapport est soit vide, soit un paramètre obligatoire n'est pas rempli !");
                    $("#exampleModal").modal('show');
                }
            }
        },

        success: function () {
            console.log("report completed");
            $(".feature_btn").prop("disabled", false);
        },

        error: function (error) {
            instance.drawResource_var_dict["cancel"] < 2 ? instance.recreateInactiveTimeout(instance) : console.log("");
            //get input controls
            var ic = v.inputControls({
                resource: instance.drawResource_var_dict["first_resource_data"][0],
                success: function (data) {
                    console.log(Object.getOwnPropertyNames(data));
                },
                error: function (e) {
                    // problème pour charger les contrôles d'entrée ? On affiche un message spécial dans le modal
                    $("#ic").html("<i style='color:red;'>Erreur lors du chargement des contrôles d'entrée, le rapport semble corrompu.<i>");
                    $("#error_message").html("<i style='color:red;'>Erreur lors du chargement des contrôles d'entrée, le rapport semble corrompu.<i>");
                }
            });

            console.log("error when loading report => "+error);

            //if the error concerns undefined parameters (NOT MANUAL CANCEL), catch it to exec specific behaviour
            if(instance.drawResource_var_dict["cancel"] == 0){
              alert("Impossible de charger le rapport sans renseigner tous les paramètres ! Veuillez compléter ce formulaire");
              $("#error_message").html("Impossible de charger le rapport sans renseigner tous les paramètres ! Cliquez sur le bouton \"modifier les paramètres\"");
              $('#modal_btn').trigger('click');
            }else if (instance.drawResource_var_dict["cancel"] == 1){
              instance.drawResource_var_dict["cancel"] = 0;
            }
        }
    });
  }

  //function that will configure inputControls of a report (options, generation events, HTML container to provide, ...)
  configInputControls(instance, v){
    /// input controls section ///
    instance.drawResource_var_dict["inputControls"] = v.inputControls({
        resource: instance.drawResource_var_dict["first_resource_data"][0],
        container: "#ic",
        params: {},
        events: {
            change: function (params, error) {
                // Update my_params variable when the values doesn't trigger an error, it will be
                //used to load the report when you want to run a report with specific parameters
                console.log("change ic");
                console.log("params structure : "+Object.getOwnPropertyNames(params));
                console.log("params acti ? => "+params["Activite"]);
                console.log("params acti collection ? => "+params["Activite_collection"]);
                console.log("params IC.activite ? => "+params["IC.activite"]);
                if (!error) {
                    $("#submit_input_control").prop('disabled', false);
                    instance.drawResource_var_dict["my_params"] = params;
                    instance.drawResource_var_dict["cancel"] < 2 ? instance.recreateInactiveTimeout(instance) : console.log("");
                    console.log("no error in loading input control func, my params = "+ instance.drawResource_var_dict["my_params"]);
                } else {
                    $("#submit_input_control").prop('disabled', true);
                    console.log("-----------------------------cant load input controls, error");
                    //instance.drawResource_var_dict["my_params"] = undefined;
                }
            }
        },
        success: function (controls) {
          console.log("controls loaded, success function ");
          //clean custom_params section on inputControls (only usefull if custom params can't be displayed for the user)
          $("#custom_params").html(""); 
          //Get custom parameters in a local var
          var custom_default_values_dict = instance.custom_params;
          //variable that check if at least one custom value have been replaced (usefull for error logging)
          //could be used later to deactivate custom default values replacement when an error occurs
          var custom_value_replacement_occured = false;

          //get all params very easily (workaround found in the documentation)
          var parameters = instance.drawResource_var_dict["inputControls"].data().parameters;
         
          //logs
          console.log("parameters "+Object.getOwnPropertyNames(parameters) + " typeof = "+typeof parameters);
          console.log("controls "+Object.getOwnPropertyNames(controls));

          //iteratation on parameters to modify them
          // if custom default value dict is not null (already set by the user) ==> Should always be the case for now,
          // check all "bad values" before replace (if a select == ~NOTHING~, don't replace)
          
          if(custom_default_values_dict !== undefined && custom_default_values_dict !== null){
            for(var key in parameters){
              //if key is included in one of our custom parameters key, replace the value
              if(Object.keys(custom_default_values_dict).includes(key)){
                console.log("Old param key "+parameters[key]+" type of data = "+typeof parameters[key]);
                //"NO NEED to encapsulate data with [] to provide the good format for visualize.js"
                //if there is a value in the custom input control, use it
                if(custom_default_values_dict[key] != "" && custom_default_values_dict[key] != undefined && 
                  custom_default_values_dict[key] !== null && custom_default_values_dict[key] != "~NOTHING~"){
                  parameters[key] = custom_default_values_dict[key];
                  console.log("New param key "+parameters[key]+" type of data = "+typeof parameters[key])
                  custom_value_replacement_occured = true;
                }
              }
            }
            //update ic with new default params
            instance.drawResource_var_dict["inputControls"].params(parameters).run().done(function(){
              console.log("input control update success");
            }).fail(function(error){
              console.log("input control update failed : "+error);
              //bug occured, display custom params in the inputControls jasper UI menu + message to explain why parameters are not updated
              var html_str = "";
              html_str += "<b><i>Bug pour charger les paramètres personnalisés, voici les paramètres utilisés : </i></b>";
              html_str += "<ul>";
              //display all inputControls used on the report
              for(var key in parameters){
                html_str += "<li>"+key + " : "+parameters[key]+"</li>"; 
              }

              html_str += "</ul>";
              $("#custom_params").html(html_str); 
              //alert("Erreur lors de l\'utilisation des paramètres que vous avez configuré dans le menu config, essayez de les modifier ou de revenir au mode classique");
            });

          }
          
          //additionnal log          
          // console.log("print all parameters infos before the run");
          // for(var key in parameters){
          //   console.log("key : "+key+" value : "+parameters[key] + " type of val : "+ typeof parameters[key] + " properties : \n"+Object.getOwnPropertyNames(parameters[key][0]));
          // }

          //if we need to extract parameters to be sure that everything is ok => https://stackoverflow.com/questions/33780271/export-a-json-object-to-a-text-file

          //run the report with parameters
          instance.drawResource_var_dict["report"].params(parameters).run().done( function(){
              console.log("report params run OK");
              instance.drawResource_var_dict["cancel"] < 2 ? instance.recreateInactiveTimeout(instance) : console.log("");
              //deactivate loader + cancel button
              $("#loading_resource").css("display", "none");
              $(".feature_btn").prop("disabled", false);
            }).fail( function(error){
              console.log("error when loading report => "+error);
              //if the error has potentially been caused by the custom default value replacement mode, warn the user
              if(custom_value_replacement_occured){
                alert("une erreur s'est déclenchée, elle est peut être causée par votre remplacement des valeurs par défaut des paramètres des rapports,"+
                  " vous devriez essayer en désactivant ce remplacement");
              }
              instance.drawResource_var_dict["cancel"] < 2 ? instance.recreateInactiveTimeout(instance) : console.log("");
              //get input controls
              var ic = v.inputControls({
                  resource: instance.drawResource_var_dict["first_resource_data"][0],
                  success: function (data) {
                      console.log(Object.getOwnPropertyNames(data));
                  },
                  error: function (e) {
                      // problème pour charger les contrôles d'entrée ? On affiche un message spécial dans le modal
                      $("#ic").html("<i style='color:red;'>Erreur lors du chargement des contrôles d'entrée, le rapport semble corrompu.<i>");
                      $("#error_message").html("<i style='color:red;'>Erreur lors du chargement des contrôles d'entrée, le rapport semble corrompu.<i>");
                  }
              });

              //if the error concerns undefined parameters (NOT MANUAL CANCEL), catch it to exec specific behaviour
              if(instance.drawResource_var_dict["cancel"] == 0){
                alert("Impossible de charger le rapport sans renseigner tous les paramètres ! Veuillez compléter ce formulaire");
                $("#error_message").html("Impossible de charger le rapport sans renseigner tous les paramètres ! Cliquez sur le bouton \"modifier les paramètres\"");
                $('#modal_btn').trigger('click');
              }else if (instance.drawResource_var_dict["cancel"] == 1){
                instance.drawResource_var_dict["cancel"] = 0;
              }
            });
        },
        error: function (error) {
          console.log("error in get input control section : "+error);
          //instance.drawResource_var_dict["my_params"] = undefined;
        }
    });
  }

  //function to check if after 30 sec the resource is initialized or not, if it's not the case, abort the loading process
  checkResourceTimeout(instance){
    //time to check timeout after init resource :
    //if timeout (30 sec or timeout_number var), destroy resource + warn user
    // if the report is loaded or another action executed, this timeout func is destroyed
    instance.vizjs_view_timeouts.push(setTimeout(function() {
      console.log("test timeout destroy"); //? : res viewed : "+instance.resources_viewed +" res viewed passed :"+current_viewed);
        alert("Chargement interrompu : la ressource est trop longue à charger, changez de ressources / de paramètres");
        //instance.drawResource_var_dict["my_params"] = undefined;
        $("#submit_input_control").prop('disabled', true);
        //hide cancel button and loader, display specific error message
        $("#loading_resource").css("display", "none");
        $("#ic").html("<i style='color:red;'>La ressource a pris trop de temps pour être chargé et a été détruite, changez de ressource avec la barre déroulante. (Si vous voulez exécuter à nouveau cette ressource, cliquez sur une autre ressource / un autre onglet et sélectionner la à nouveau)<i>");
        $("#error_message").html("<i style='color:red;'>La ressource a pris trop de temps pour être chargé et a été détruite, changez de ressource avec la barre déroulante. (Si vous voulez exécuter à nouveau cette ressource, cliquez sur une autre ressource / un autre onglet et sélectionner la à nouveau)<i>");

        if(instance.drawResource_var_dict["first_resource_data"][1] == "dashboard"){
          console.log("TOO LONG, KILL DASHBOARD "+instance.folder_choice);
          console.log("time to destroy");
          instance.drawResource_var_dict["dashboard"].destroy().then(function () {
            console.log("Dashboard Destroyed!");
          })
          .fail(function () {
            console.log("Can\'t Destroy Dashboard");
          });
        }else if(instance.drawResource_var_dict["first_resource_data"][1] == "adhocDataView"){
          console.log("TOO LONG, KILL ADHOC "+instance.folder_choice);
          console.log("time to destroy");
          instance.drawResource_var_dict["adhocView"].destroy().then(function () {
            console.log("Adhoc Destroyed!");
          })
          .fail(function () {
            console.log("Can\'t Destroy Adhoc");
          });
        }else{
          console.log("TOO LONG, KILL REPORT "+instance.folder_choice);
          console.log("time to destroy");
          instance.drawResource_var_dict["report"].destroy().then(function () {
            console.log("Report Destroyed!");
          })
          .fail(function () {
            console.log("Can\'t Destroy Report");
          });
        }
    }, instance.timeout_number));
  }

  //function called when the user submit a new word search inside a report
  //it will update variables and highlight all occurences / show a error message if nothing was found
  submitNewSearchButton(instance){
        //update params values
        instance.custom_search_in_report = $("#search-query").val();
        instance.custom_search_parameters_in_report[0] = $("#case_sensitive_search").is(":checked");
        instance.custom_search_parameters_in_report[1] = $("#word_only_search").is(":checked");

        //if the search criteria is empty, leave the function
        if(instance.custom_search_in_report == ""){
          console.log("search criteria empty : "+instance.custom_search_in_report+", leaving search");

          //trigger reload search
          $( "#reload_search" ).click();

          return ;
        }
        //change color based on parameters currentely used
        if($("#case_sensitive_search").is(":checked")){ 
          $("#case_sensitive_search_icon").css('color', "green");
        }else{
          $("#case_sensitive_search_icon").css('color', "red");
        }

        if($("#word_only_search").is(":checked")){ 
          $("#word_only_search_icon").css('color', "green");
        }else{
          $("#word_only_search_icon").css('color', "red");
        }

        //hide modal
        $('#searchModal').modal('hide');

        //get usefull data about the research in an array
        var first_page_with_custom_search = 1;

        //boolean true if there is an occurence of the "search criteria" in the current page
        var custom_search_in_current_page = false;

        //try to use report_2 tempo var instead of report to avoid bugs (seems working 50% of time)
        var report_2 = instance.drawResource_var_dict["report"];
        //instance.tryTriggerRun(instance, report_2);
        console.log("try trigger run");
        report_2.search({
            text: instance.custom_search_in_report,
            caseSensitive: instance.custom_search_parameters_in_report[0],
            wholeWordsOnly: instance.custom_search_parameters_in_report[1]
        })
            .done(function(results){ 
                console.log("search done");
                if(!results.length){
                  console.log("The search did not return any results!");
                  alert("Aucun résultat trouvé pour votre recherche ! \n" +
                    "Réinitialisation des paramètres (vous aviez choisi \n"+
                    "mot : "+instance.custom_search_in_report + "\nsensible à la casse : "+
                    instance.custom_search_parameters_in_report[0]+"\nmots entiers : "+
                    instance.custom_search_parameters_in_report[1]+")");
                    //trigger reload search
                    $( "#reload_search" ).click();
                    return ;
                }
                for (var i = 0; i < results.length; i++) {
                    //init the first page
                    if(i == 0){
                      first_page_with_custom_search = results[i].page;
                    }
                    console.log("found " + results[i].hitCount + " results on page: #" +
                                results[i].page);

                    //change boolean if the search word exist in the current page
                    if(results[i].page == report_2.pages()){
                      custom_search_in_current_page = true;
                    }
                }

                //stock results in an instance var
                instance.custom_search_usefull_data = results;

                //update content of the search modal to enable the "search results by page"
                $("#label_search_group_navigation").html("<p><b>Navigation entre les pages contenant le mot <b class='text-danger'>"+instance.custom_search_in_report+"</b></b></p>");

                var html_for_results_by_page = "";
                html_for_results_by_page += 
                "<div class='row col-md-12'><button name='"+results[0].page+"' class='col-md-5 custom_search_page_btn btn btn-hover btn-success'>Page min = "+
                results[0].page+"</button><p class='col-md-2'></p><button name='"+results[results.length-1].page+
                "' class='col-md-5 custom_search_page_btn btn btn-hover btn-dark'>Page max ="+results[results.length-1].page+"</button></div><br>";

               //create the first 5 buttons, the rest is created with intern pagination
                for(var i = 0; i < results.length; i++){
                  
                  if(i == 5){
                    break;
                  }

                  html_for_results_by_page += "<button name='"+results[i].page+"' class='col-md-5 custom_search_page_btn btn btn-hover btn-info'>Page "+results[i].page+", mots = "
                  +results[i].hitCount+"</button><br><br>";
                }

                //set intern pagination index to 1
                instance.custom_search_pagination_index = 1;

                //update intern pagination label (show how many intern pages they are (22 results == 4 intern pages))
                $("#intern_page_label").html("page "+instance.custom_search_pagination_index+" / "+Math.ceil(instance.custom_search_usefull_data.length/5));

                $("#search_results_by_page").html(html_for_results_by_page);

                //show custom search occurences by pages button
                $("#searchNavigationModal-button").css("display", "block");


                //if there is at least 1 result inside the current viewed page, stay in this page
                if(custom_search_in_current_page){
                  console.log("custom search in current page");
                  //$('#page').val(first_page_with_custom_search).trigger('change');
                  $('#page').val(report_2.pages()).trigger('change');
                }else{
                  //else, run report at the first page where custom search was found (update trigger change event)
                  $('#page').val(first_page_with_custom_search).trigger('change');
                }
                //destroy report_2, maybe not usefull but could prevent bugs
                report_2 = null;

            })
            .fail(function(error){
              console.log("Error in report search function, error : "+error);
              //destroy report_2, maybe not usefull but could prevent bugs
              report_2 = null;
              alert("The search did not work properly => error :"+error);
            });

        //Bug when reload, trigger #page on change event seems better than the old solution 
        // (force rerun report and not only pages) but can lead to other bugsneed to monitor this
  }

  //function to modify the page to display according to the presence of the "search criteria"
  //if our word is "WEB" and is in page 3, when you click on the Page 3 button, the page will be updated
  customSearchPageButton(event){
    //$('button.custom_search_page_btn').click(function(event) {
    //trigger page update
    console.log("this btn name attribute => ", event.target.name)
    $('#page').val(event.target.name).trigger('change');
    //hide modal
    $('#searchNavigationModal').modal('hide');
    $('#searchModal').modal('hide');
  }

  //function to change intern pages of the custom search criteria mode (this page contains buttons that
  // redirect to a page to display according to the presence of the search criteria)
  internPaginationButton(instance, event){
    //$('button.intern_pagination_btn').click(function(event) {
    console.log("change inter search page");
    //var to get new first index of the button
    var index_new_button = 0;
    if(event.target.name == "previous_intern_pagination"){
      
      if(instance.custom_search_pagination_index <= 1){
        alert("Vous êtes déjà sur la première page");
        return ;
      }else{
        //clean old html
        $("#search_results_by_page").html("");
        //update index of pagination
        instance.custom_search_pagination_index -= 1;
        //get new first index of the button
        index_new_button = (instance.custom_search_pagination_index * 5) - 5;
      }
    }else{
      if(instance.custom_search_pagination_index >= Math.ceil(instance.custom_search_usefull_data.length/5)){
        alert("Vous êtes déjà sur la dernière page");
        return ;
      }else{
        //clean old html
        $("#search_results_by_page").html("");
        //update index of pagination
        instance.custom_search_pagination_index += 1;
        //get new first index of the button
        index_new_button = (instance.custom_search_pagination_index * 5) - 5;
      }
    }

    //start to change html view
    var html_for_results_by_page = "<div class='row col-md-12'><button name='"+instance.custom_search_usefull_data[0].page+
    "' class='col-md-5 custom_search_page_btn btn btn-hover btn-success'>Page min = "+instance.custom_search_usefull_data[0].page+
    "</button><p class='col-md-2'></p><button name='"+instance.custom_search_usefull_data[instance.custom_search_usefull_data.length-1].page+
    "' class='col-md-5 custom_search_page_btn btn btn-hover btn-dark'>Page max ="+
    instance.custom_search_usefull_data[instance.custom_search_usefull_data.length-1].page+"</button></div><br>";

    //create all buttons for this index
    for(var i = index_new_button; i < instance.custom_search_pagination_index * 5; i++){
       if(i == instance.custom_search_usefull_data.length){
         break;
       }
       html_for_results_by_page += "<button name='"+instance.custom_search_usefull_data[i].page+"' class='col-md-5 custom_search_page_btn btn btn-hover btn-info'>Page "+
       instance.custom_search_usefull_data[i].page+", mots = "+instance.custom_search_usefull_data[i].hitCount+"</button><br><br>";
    }

    //update intern pagination label (show how many intern pages they are (22 results == 4 intern pages))
    $("#intern_page_label").html("page "+instance.custom_search_pagination_index+" / "+Math.ceil(instance.custom_search_usefull_data.length/5));
    $("#search_results_by_page").html(html_for_results_by_page);
  }

  //function to delete current search and execute report with current parameters 
  //NOTE : It's possible to extract initialisation inside another function to use it at the
  //beginning of ressources on change
  reloadSearch(instance){
    console.log("RELOAD SEARCH ACTIVATED");
    //reset val of search query and option checkboxes
    $("#search-query").val("");
    $("#case_sensitive_search").prop('checked', false);
    $("#case_sensitive_search_icon").css('color', "red");
    $("#word_only_search").prop('checked', false);
    $("#word_only_search_icon").css("color", "red");
    
    //update custom search word and search parameters
    instance.custom_search_in_report = "";
    instance.custom_search_parameters_in_report = [false, false];
    instance.custom_search_usefull_data = "";
    
    //hide modal
    $('#searchModal').modal('hide');

    //hide custom search occurences by pages button
    $("#searchNavigationModal-button").css("display", "none");

    //run report with custom params when they are not equal to undefined, else run with default options
    if(instance.drawResource_var_dict["my_params"] === undefined){
      $('#resource_selection').trigger('change');
    }else{
      $( "#submit_input_control" ).click();
    }
  }

  //function to cancel the execution of a visualize JS resource
  cancelExecution(instance){
    instance.drawResource_var_dict["cancel"] = 1;
    //alert("CANCEL EXECUTION");
    instance.drawResource_var_dict["cancel"] < 2 ? instance.recreateInactiveTimeout(instance) : console.log("");
    console.log("CANCEL EXECUTION ");
    if(instance.drawResource_var_dict["current_resource_type"] == "adhocDataView"){
      console.log("manual destroy adhocView execution");
      instance.drawResource_var_dict["adhocView"].destroy().then(function () {
          console.log("Adhoc Destroyed!");
        })
        .fail(function () {
          console.log("Can\'t Destroy Adhoc");
        });        
    }else if(instance.drawResource_var_dict["current_resource_type"] == "dashboard"){
      console.log("manual cancel dashboard execution");
      instance.drawResource_var_dict["dashboard"].cancel().then(function(){
        console.log("Dashboard canceled!");
      }).fail(function () {
        console.log("Can\'t Cancel Dashboard");
      });
    }else{
      //store report parameters to avoid problems
      console.log("manual cancel report execution");
      instance.drawResource_var_dict["report"].cancel().then(function(){
        console.log("Report canceled!");
        //if the first exec is canceled (params are not set yet), specific error message
        // if(instance.drawResource_var_dict["my_params"] === undefined){
        //   alert("Stopper l\'exécution de la 1ère ressource empêche sa modification future (bug), changez de resource et retournez sur celle ci pour contourner le problème");
        //   $("#error_message").html("<i style='color:red;'>Stopper l\'exécution de la 1ère ressource empêche sa modification future (bug), 
        //   changez de resource et retourner sur celle ci pour contourner le problème<i>");
        // }
      }).fail(function(){
        console.log("Can\'t Cancel Report");
      })
    }
  }

  //function to reset the parameters of the current report 
  reloadDefaultReport(instance){
    console.log("reload report with default parameters");
    instance.drawResource_var_dict["my_params"] = undefined;
    $('#exampleModal').modal('hide');
    //reload report
    $('#resource_selection').trigger('change');
  }

  //function to execute the current report with new parameters
  submitInputControlButton(instance){
    //alert("submit manual, my params = "+instance.drawResource_var_dict["my_params"]);
    console.log("submit manual input controls, my params = "+instance.drawResource_var_dict["my_params"]);

    //clean custom_params section on inputControls (only usefull if custom params can't be displayed for the user)
    $("#custom_params").html(""); 

    //force reset custom search (criteria) if updated input controls are manual
    //if there are "auto", it just means that we want to do a search on a parameters modified report
    if(instance.drawResource_var_dict["activate_search_for_input_controls"] == 0){
      console.log("CLEAN SEARCH, MANUAL CHANGE INPUT CONTROLS");
      //reset val of search query and option checkboxes
      $("#search-query").val("");
      $("#case_sensitive_search").prop('checked', false);
      $("#case_sensitive_search_icon").css('color', "red");
      $("#word_only_search").prop('checked', false);
      $("#word_only_search_icon").css("color", "red");
      
      //update custom search word and search parameters
      instance.custom_search_in_report = "";
      instance.custom_search_parameters_in_report = [false, false];
      instance.custom_search_usefull_data = "";

      //hide custom search occurences by pages button
      $("#searchNavigationModal-button").css("display", "none");
    }else{
      console.log("NO CLEAN SEARCH");
    }

    //display a special button to enter in the page search menu
    // where all pages which contains the custom search word is displayed
    $("#loading_resource").css("display", "block");

    //disable feature bar
    $(".feature_btn").prop("disabled", true);
    
    //alert("DISPLAY BTN");
    $("#error_message").html("");
    instance.drawResource_var_dict["cancel"] < 2 ? instance.recreateInactiveTimeout(instance) : console.log("");
    console.log("---------------------------input control loaded, my params = "+instance.drawResource_var_dict["my_params"]);
    console.log("my_params detail : "+Object.getOwnPropertyNames(instance.drawResource_var_dict["my_params"])+" acti : |"+
      instance.drawResource_var_dict["my_params"]["Activite"]+"|");
    // $("#export_button").prop("disabled", false); + other HTML modif if needed
    
    //run the report with new parameters
    instance.drawResource_var_dict["report"].params(instance.drawResource_var_dict["my_params"]).pages(1).run().done( function(){
      instance.drawResource_var_dict["cancel"] < 2 ? instance.recreateInactiveTimeout(instance) : console.log("");
      //deactivate loader + cancel button
      $("#loading_resource").css("display", "none");
      console.log("report params run OK");
      $(".feature_btn").prop("disabled", false);
    }).fail( function(error){
      console.log("typeof error = "+typeof error+" | error "+error);
      //if the strange error is triggered, reinitialize the report and display a custom message
      if(typeof error == "string" && error.includes("webservices.error.errorExportingReportUnit")){
        alert("Bug innatendu causé par la recherche, reinitialisation du rapport");
        $( "#reload_default_report" ).click();

      }
      if(instance.drawResource_var_dict["cancel"] == 0 && !(error["message"].includes("cancelled"))){
        alert("problème lors de l'exécution du rapport avec vos paramètres : "+error);
      }
    });

    $('#exampleModal').modal('hide');

    //if timeout (30 sec / timeout_number var), destroy resource + warn user
    //if another action is triggered (change page / report), this timeout function will be destroyed

    instance.vizjs_view_timeouts.push(setTimeout(function() {
      console.log("test timeout destroy "); //"? : res viewed : "+instance.resources_viewed +" res viewed passed :"+current_viewed);
      //if(current_viewed == instance.resources_viewed){
        alert("Chargement interrompu : la ressource est trop longue à charger, changez de ressources / de paramètres");
        //instance.drawResource_var_dict["my_params"] = undefined;
        $("#submit_input_control").prop('disabled', true);
        //hide cancel button and loader, display specific error message
        $("#loading_resource").css("display", "none");
        $("#ic").html("<i style='color:red;'>La ressource a pris trop de temps pour être chargé et a été détruite, changez de ressource avec la barre déroulante."+
          "(Si vous voulez exécuter à nouveau cette ressource, cliquez sur une autre ressource / un autre onglet et sélectionner la à nouveau)<i>");
        $("#error_message").html("<i style='color:red;'>La ressource a pris trop de temps pour être chargé et a été détruite, changez de ressource avec la barre déroulante."+
          " (Si vous voulez exécuter à nouveau cette ressource, cliquez sur une autre ressource / un autre onglet et sélectionner la à nouveau)<i>");


        console.log("TOO LONG, KILL REPORT "+instance.folder_choice);
        console.log("time to destroy");
        instance.drawResource_var_dict["report"].destroy().then(function () {
          console.log("Report Destroyed!");
        })
        .fail(function () {
          console.log("Can\'t Destroy report");
          //deactivate loader + cancel button
          $("#loading_resource").css("display", "none");
        });
      //}
    }, instance.timeout_number));
  }

  //if the user click on another page (auth or vizjs-config), we need to destroy the current ressource before
  linkAuthButton(instance){
    instance.drawResource_var_dict["cancel"] = 2;
    $("#link_auth").off('click');
    //alert("kill resource before");
    if(instance.drawResource_var_dict["current_resource_type"] == ""){
      console.log("first iteration, no need to destroy");
    }
    else if(instance.drawResource_var_dict["current_resource_type"] == "report"){
      console.log("cancel report");
      //report.cancel();
      instance.drawResource_var_dict["report"].destroy().fail(function() {  });
    }else if(instance.drawResource_var_dict["current_resource_type"] == "dashboard"){
      console.log("cancel dashboard");
      //instance.drawResource_var_dict["dashboard"].cancel();
      instance.drawResource_var_dict["dashboard"].destroy();
    }else{
      console.log("cancel adhocView");
      //instance.drawResource_var_dict["adhocView"].cancel();
      instance.drawResource_var_dict["adhocView"].destroy();
    }
  }

  //if the user click on another page (auth or vizjs-config), we need to destroy the current ressource before
  linkVizJSConfigButton(instance){
    instance.drawResource_var_dict["cancel"] = 2;
    $("#link_vizjs-config").off('click');
    //alert("kill resource before");
    if(instance.drawResource_var_dict["current_resource_type"] == ""){
      console.log("first iteration, no need to destroy");
    }
    else if(instance.drawResource_var_dict["current_resource_type"] == "report"){
      console.log("cancel report");
      //report.cancel();
      instance.drawResource_var_dict["report"].destroy().fail(function() {  });
    }else if(instance.drawResource_var_dict["current_resource_type"] == "dashboard"){
      console.log("cancel dashboard");
      //instance.drawResource_var_dict["dashboard"].cancel();
      instance.drawResource_var_dict["dashboard"].destroy();
    }else{
      console.log("cancel adhocView");
      //adhocView.cancel();
      instance.drawResource_var_dict["adhocView"].destroy();
    }
  }

  //go to the previous page
  previousPage(instance){
    instance.drawResource_var_dict["currentPage"] = instance.drawResource_var_dict["report"].pages() || 1;
    console.log("PREVIOUS PAGE TOTAL PAGES => " + instance.drawResource_var_dict["totalPages"]);
     $("#page_label").html("page " + (instance.drawResource_var_dict["currentPage"]-1) + " / " + instance.drawResource_var_dict["totalPages"] + " :");
    instance.drawResource_var_dict["report"]
        .pages(--instance.drawResource_var_dict["currentPage"])
        .run()
        .done(function (ok) {
            console.log("ok change page");
            instance.drawResource_var_dict["cancel"] < 2 ? instance.recreateInactiveTimeout(instance) : console.log("");
            //update page num
            // $("#page_label").html("page " + currentPage + " / " + instance.drawResource_var_dict["totalPages"] + " :");
        })
        .fail(function (err) { 
          alert(err);
          $("#page_label").html("page " + (instance.drawResource_var_dict["currentPage"]+1) + " / " + instance.drawResource_var_dict["totalPages"] + " :"); 
        });
  }

  //go to the next page of the report
  nextPage(instance){
    instance.drawResource_var_dict["currentPage"] = instance.drawResource_var_dict["report"].pages() || 1;
    console.log("NEXT PAGE TOTAL PAGES => " + instance.drawResource_var_dict["totalPages"]);//+" current page => "+instance.drawResource_var_dict["currentPage"]);
    $("#page_label").html("page " + (instance.drawResource_var_dict["currentPage"]-(-1)) + " / " + instance.drawResource_var_dict["totalPages"] + " :");

    instance.drawResource_var_dict["report"]
        .pages(++instance.drawResource_var_dict["currentPage"])
        .run()
        .done(function (ok) {
            console.log("ok change page");
            instance.drawResource_var_dict["cancel"] < 2 ? instance.recreateInactiveTimeout(instance) : console.log("");
            //update page num
            //$("#page_label").html("page " + instance.drawResource_var_dict["currentPage"] + " / " + instance.drawResource_var_dict["totalPages"] + " :");
        })
        .fail(function (err) { 
          alert(err);
          //v.logout();
          $("#page_label").html("page " + (instance.drawResource_var_dict["currentPage"]-1) + " / " + instance.drawResource_var_dict["totalPages"] + " :"); 
        });
  }

  //update the current page of the report
  updatePage(instance, button){
    console.log("CHANGE PAGE TOTAL PAGES => " + instance.drawResource_var_dict["totalPages"]);
    //get user's custom input value
    var value = $(button).val();
    if (isNaN(value)) {
      alert("veuillez entrer un entier");
      value = 1;
    }
    instance.drawResource_var_dict["report"]
        .pages(value)
        .run()
        .done(function (ok) {
            console.log("ok change page");
            instance.drawResource_var_dict["cancel"] < 2 ? instance.recreateInactiveTimeout(instance) : console.log("");
            //update page num
            $("#page_label").html("page " + value + " / " + instance.drawResource_var_dict["totalPages"] + " :");
            $('#page').val("");
        })
        .fail(function (e) { console.log(instance.drawResource_var_dict["report"].pages()); alert(e); });
  }

  //function to make the report container taller
  zoomPlus(instance){
    instance.drawResource_var_dict["currentPage"] = instance.drawResource_var_dict["report"].pages() || 1;

    console.log("zoom curr page = "+instance.drawResource_var_dict["currentPage"]);

    //change container size
    var current_height_zoomed = document.getElementById("resource_container").offsetHeight + Math.round(instance.container_size*0.1);
    console.log("CURRENT HEIGHT = " + current_height_zoomed)

    //if zoom is too high, fix a limit
    if (current_height_zoomed > instance.container_size*3) {
        current_height_zoomed = instance.container_size*3;
    }

    $("#resource_container").css("height", current_height_zoomed + "px");

    //update % label value
    $("#zoom_custom_label").html("Zoom (" + Math.round((current_height_zoomed / instance.container_size) * 100) + "%) :");


    instance.drawResource_var_dict["report"]
        .pages(instance.drawResource_var_dict["currentPage"])
        .run()
        .done(function(ok){ instance.drawResource_var_dict["cancel"] < 2 ? instance.recreateInactiveTimeout(instance) : console.log(""); })
        .fail(function (err) { alert(err); });    
  }

  //function to make the report container smaller
  zoomMinus(instance){
    instance.drawResource_var_dict["currentPage"] = instance.drawResource_var_dict["report"].pages() || 1;

    //change container size
    var current_height_dezoomed = document.getElementById("resource_container").offsetHeight - Math.round(instance.container_size*0.1);
    console.log("CURRRRR HEIGHT = " + current_height_dezoomed);

    //if zoom is too low, fix a limit
    if (current_height_dezoomed < instance.container_size*0.25) {
        current_height_dezoomed = Math.round(instance.container_size*0.25);
    }

    $("#resource_container").css("height", current_height_dezoomed + "px");

    //update % level value
    $("#zoom_custom_label").html("Zoom (" + Math.round((current_height_dezoomed / instance.container_size) * 100) + "%) :");

    instance.drawResource_var_dict["report"]
        .pages(instance.drawResource_var_dict["currentPage"])
        .run()
        .done(function(ok){ instance.drawResource_var_dict["cancel"] < 2 ? instance.recreateInactiveTimeout(instance) : console.log(""); })
        .fail(function (err) { alert(err); });
  }

  //function to make custom zoom (update the report container size => should be > 25% && < 300% of the original size)
  customZoom(instance, button){
    instance.drawResource_var_dict["currentPage"] = instance.drawResource_var_dict["report"].pages() || 1;
    //user input value
    var value = $(button).val();
    value = parseInt(value, 10);
    if (isNaN(value)) {
      alert("veuillez entrer un entier");
      value = 100;
    }

    if (value < 25 || value > 300) {
        alert("Veuillez entrer une valeur comprise entre 25 et 300");
        value = instance.container_size;
    } else {
        value = Math.round((value / 100) * instance.container_size);
    }

    console.log("CUSTOM ZOOM : " + value);
    $("#resource_container").css("height", value + "px");

    //update % level value and clear custom input
    $("#zoom_custom_label").html("Zoom (" + Math.round((value / instance.container_size) * 100) + "%) :");
    $('#zoom_custom').val("");

    instance.drawResource_var_dict["report"]
        .pages(instance.drawResource_var_dict["currentPage"])
        .run()
        .done(function(ok){ instance.drawResource_var_dict["cancel"] < 2 ? instance.recreateInactiveTimeout(instance) : console.log(""); })
        .fail(function (e) { console.log(instance.drawResource_var_dict["report"].pages()); alert(e); });
  }

  //function to export the report to a specified format (PDF, CSV, XLS, JSON, ...)
  exportButton(instance, select){
    console.log(select.val());

    instance.drawResource_var_dict["report"].export({
        //export options here
        outputFormat: select.val(),
        //pages: "1-2" //exports all pages if not specified
    }, function (link) {
        instance.drawResource_var_dict["cancel"] < 2 ? instance.recreateInactiveTimeout(instance) : console.log("");
        var url = link.href ? link.href : link;
        window.location.href = url;
    }, function (error) {
        console.log(error);
    });
  }

  //Load the jaspersoft resource inside the webpage + all events linked to this resource
  drawResource(instance, username, password, first_resource_data, folder_choice){
  	console.log("Enter in drawResource func");
    //all visualize features will be used here, we need to configure the jaspersoft credentials
    visualize.config({
	    auth: {
	        name: username,
	        password:password
	    }
	  });

  	visualize(function (v) {
      //function to init vars and HTML
      instance.initHTMLViewAndVariables(instance, first_resource_data);   

      
      //when the user choose an element in the select resource control, change the current resource
      //and generate a dashboard / adhocView / report + inputControls depending on the choice made
      $("#resource_selection").on("change", function () {
        instance.onChangeReinit(instance, v);

        if (instance.drawResource_var_dict["first_resource_data"][1] == "dashboard") {
            instance.configDashboard(instance, v);
        } else if (instance.drawResource_var_dict["first_resource_data"][1] == "adhocDataView") {
            instance.configAdhocView(instance, v);
        } else {
          instance.configReport(instance, v, folder_choice);
          instance.configInputControls(instance, v);
        }
       
        //time to check timeout after init resource :
        //if timeout (30 sec or timeout_number var), destroy resource + warn user
        // if the report is loaded or another action executed, this timeout func is destroyed
        instance.checkResourceTimeout(instance);

      });
      
      //if current resource type is not set (application is running the 1st resource), 
      //create features + events functions and trigger the onchange event (after)

      //EVENTS HANDLERS (search word in report + click to submit new parameters + click to cancel resource execution)

      //update current search and re-run the report
      $("#submit_new_search").click(function(){
        instance.submitNewSearchButton(instance);
      });

      //CUSTOM SEARCH INTERN FUNCTIONS (PAGINATION)
      
      //function to modify the page to display according to the presence of the "search criteria"
      //if our word is "WEB" and is in page 3, when you click on the Page 3 button, the page will be updated
      $(document).on('click','button.custom_search_page_btn', function(event){
        instance.customSearchPageButton(event);
      });

      //function to change page (previous/next)
      $(document).on('click','button.intern_pagination_btn', function(event){
        instance.internPaginationButton(instance,event);
      });


      //button to delete current search and execute report with current parameters 
      //NOTE : It's possible to extract initialisation inside another function to use it at the
      //beginning of ressources on change
      $("#reload_search").click(function(){
        instance.reloadSearch(instance);
      });

      //cancel resource execution if a button is clicked
      $( "#cancel_execution" ).click(function() {
        instance.cancelExecution(instance);
      });

      //function to reset the parameters of the current report 
      $( "#reload_default_report" ).click(function() {
        instance.reloadDefaultReport(instance);
      });

      //execute the current report with new parameters
      $( "#submit_input_control" ).click(function() {
        instance.submitInputControlButton(instance);
      });

      //if the user clic on another page (auth or vizjs-config), we need to destroy the current ressource before
      $("#link_auth").click(function(e) {
        instance.linkAuthButton(instance);
      });

      $("#link_vizjs-config").click(function(e) {
        instance.linkVizJSConfigButton(instance); 
      });

      //// FEATURES BAR CODE (ZOOM, CHANGE PAGE, ...) ////

      //// PAGINATION SECTION ////

      //previous pagination
      $("#previousPage").click(function () {
        instance.previousPage(instance);
      });

      //next pagination
      $("#nextPage").click(function () {
        instance.nextPage(instance);
      });

      //pagination search
      $("#page").on("change", function () {
        instance.updatePage(instance, this);
      });

      //// ZOOM SECTION ////

      //zoom +
      $("#zoom_plus").click(function () {
        instance.zoomPlus(instance);
      });

      //zoom -
      $("#zoom_minus").click(function () {
        instance.zoomMinus(instance);
      });

      //custom zoom
      $("#zoom_custom").on("change", function () {
        instance.customZoom(instance, this);
      });

      //// EXPORT SECTION ////

      //Call buildControl to create a "<select>" element (all export options)
      var select = instance.buildControl("", instance.report_export_formats);       
      //Export to was used here before

      //Config of the export button
      $("#export_button").click(function () {
        instance.exportButton(instance, select);
      });

      //trigger onchange event
      $('#resource_selection').trigger('change');

    });
  }
}