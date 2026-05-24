import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import { AllEnterpriseModule, LicenseManager } from 'ag-grid-enterprise';

LicenseManager.setLicenseKey("Using_this_{AG_Grid}_Enterprise_key_{AG-104999}_in_excess_of_the_licence_granted_is_not_permitted___Please_report_misuse_to_legal@ag-grid.com___For_help_with_changing_this_key_please_contact_info@ag-grid.com___{Morris_Development,_Inc.}_is_granted_a_{Single_Application}_Developer_License_for_the_application_{MorrisDevelopment}_only_for_{1}_Front-End_JavaScript_developer___All_Front-End_JavaScript_developers_working_on_{MorrisDevelopment}_need_to_be_licensed___{MorrisDevelopment}_has_not_been_granted_a_Deployment_License_Add-on___This_key_works_with_{AG_Grid}_Enterprise_versions_released_before_{13_October_2026}____[v3]_[01]_MTc5MTg0NjAwMDAwMA==2bd698437af82a720d075c1af0cf4a0e");
ModuleRegistry.registerModules([AllCommunityModule, AllEnterpriseModule]);

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
