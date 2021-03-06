/*
 * Touch+ Software
 * Copyright (C) 2015
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the Aladdin Free Public License as
 * published by the Aladdin Enterprises, either version 9 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * Aladdin Free Public License for more details.
 *
 * You should have received a copy of the Aladdin Free Public License
 * along with this program.  If not, see <http://ghostscript.com/doc/8.54/Public.htm>.
 */

var Updater = function(ipcIn, s3In, menuIn)
{
	var self = this;

	self.ipc = ipcIn;
	self.s3 = s3In;
	self.menu = menuIn;

	setInterval(self.CheckForUpdate, 3600000);
};

Updater.prototype.Enabled = false;
Updater.prototype.ipc = null;
Updater.prototype.s3 = null;
Updater.prototype.menu = null;
Updater.prototype.checkingForUpdate = false;
Updater.prototype.manualInvoke = false;
Updater.prototype.patching = false;

Updater.prototype.CheckForUpdate = function(manual)
{
	var self = this;

	if (self.patching)
		return;

	if (manual == true)
	{
		self.manualInvoke = true;
		show_notification("Checking for updates", "Please wait");
	}

	if (!self.Enabled && !manual)
		return;

	if (self.checkingForUpdate)
		return;

	self.checkingForUpdate = true;
	console.log("checking for updates");

	self.s3.GetKeys(function(keys)
	{
		var found = false;
		for (var i in keys)
		{
			var key = keys[i];
			if (key.Key == "software_update/version.txt")
			{
				found = true;

				self.s3.ReadTextKey(key.Key, function(targetVersion)
				{
					var currentVersion = ReadTextFile(ExecutablePath + "/version.nrocinunerrad")[0];
					if (targetVersion != currentVersion)
					{
						if (self.manualInvoke)
							self.patch(targetVersion);
						else
							show_notification("A new version of Touch+ software is available", "Click here to update", function()
							{
								self.patch(targetVersion);
							});
					}
					else if (self.manualInvoke)
					{
						show_notification("Touch+ software is up to date", "Current vesion: " + currentVersion);
						self.manualInvoke = false;
					}
					self.checkingForUpdate = false;
				},
				function()
				{
					if (self.manualInvoke)
						show_notification("Update failed", "please check your internet connection");

					self.checkingForUpdate = false;
					console.log("update failed");
				});

				break;
			}
		}

		if (!found)
			self.checkingForUpdate = false;
	},
	function()
	{
		if (self.manualInvoke)
			show_notification("Update failed", "please check your internet connection");

		self.checkingForUpdate = false;
		console.log("update failed");
	});
};

Updater.prototype.patch = function(targetVersion)
{
	var self = this;

	if (self.patching)
		return;

	self.patching = true;
	show_notification("Downloading update", "Please wait");

	self.s3.DownloadKey("software_update/patch.zip", ExecutablePath, function(path)
	{
		show_notification("Installing update", "Please wait");

		BlockExit = true;
		self.ipc.SendMessage("daemon_plus", "exit", "");

		setTimeout(function()
		{
			var AdmZip = require(process.cwd() + "/modules/adm-zip");
			new AdmZip(path).extractAllTo(ExecutablePath, true);
			DeleteFile(path);

			show_notification("Update finished", "Current version: " + targetVersion);

			BlockExit = false;
			
			self.patching = false;
			self.manualInvoke = false;

			console.log("update finished");

		}, 1000);
	},
	function()
	{
		if (self.manualInvoke == true)
		{
			show_notification("Update failed", "please check your internet connection");
			self.manualInvoke = false;
		}

		self.patching = false;
		console.log("update failed");
	},
	function(loaded, total)
	{
		menu.removeAt(1);
		menu.insert(new require("nw.gui").MenuItem({ type: "normal", label: loaded + " of " + total + " bytes downloaded" }), 1);
	});
}