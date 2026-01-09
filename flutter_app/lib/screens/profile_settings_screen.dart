import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:file_picker/file_picker.dart';
import 'package:ERPComm/models/profile.dart';

class ProfileSettingsScreen extends StatefulWidget {
  final Profile profile;
  final VoidCallback onUpdate;

  const ProfileSettingsScreen({super.key, required this.profile, required this.onUpdate});

  @override
  State<ProfileSettingsScreen> createState() => _ProfileSettingsScreenState();
}

class _ProfileSettingsScreenState extends State<ProfileSettingsScreen> {
  final _supabase = Supabase.instance.client;
  late TextEditingController _nameController;
  late TextEditingController _usernameController;
  bool _isLoading = false;
  String? _avatarUrl;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.profile.fullName);
    _usernameController = TextEditingController(text: widget.profile.username);
    _avatarUrl = widget.profile.avatarUrl;
  }

  @override
  void dispose() {
    _nameController.dispose();
    _usernameController.dispose();
    super.dispose();
  }

  Future<void> _pickAvatar() async {
    final result = await FilePicker.platform.pickFiles(type: FileType.image);
    if (result == null) return;

    setState(() => _isLoading = true);
    try {
      final file = result.files.first;
      final fileName = '${_supabase.auth.currentUser!.id}_avatar${DateTime.now().millisecondsSinceEpoch}.png';
      final path = 'avatars/$fileName';

      if (kIsWeb) {
        await _supabase.storage.from('avatars').uploadBinary(path, file.bytes!);
      } else {
        await _supabase.storage.from('avatars').upload(path, File(file.path!));
      }

      final url = _supabase.storage.from('avatars').getPublicUrl(path);
      setState(() => _avatarUrl = url);
    } catch (e) {
      debugPrint('Error uploading avatar: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _saveProfile() async {
    setState(() => _isLoading = true);
    try {
      await _supabase.from('profiles').update({
        'full_name': _nameController.text,
        'username': _usernameController.text,
        'avatar_url': _avatarUrl,
      }).eq('id', widget.profile.id);

      widget.onUpdate();
      if (mounted) Navigator.pop(context);
    } catch (e) {
      debugPrint('Error saving profile: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Profile Settings'),
        actions: [
          if (_isLoading)
            const Center(child: Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator(strokeWidth: 2)))
          else
            TextButton(onPressed: _saveProfile, child: const Text('Save')),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          Center(
            child: Stack(
              children: [
                CircleAvatar(
                  radius: 50,
                  backgroundImage: _avatarUrl != null ? NetworkImage(_avatarUrl!) : null,
                  child: _avatarUrl == null ? const Icon(Icons.person, size: 50) : null,
                ),
                Positioned(
                  right: 0,
                  bottom: 0,
                  child: CircleAvatar(
                    backgroundColor: Colors.black,
                    radius: 18,
                    child: IconButton(
                      icon: const Icon(Icons.camera_alt, size: 18, color: Colors.white),
                      onPressed: _pickAvatar,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 32),
          TextField(
            controller: _nameController,
            decoration: const InputDecoration(
              labelText: 'Full Name',
              hintText: 'Enter your full name',
            ),
          ),
          const SizedBox(height: 20),
          TextField(
            controller: _usernameController,
            decoration: const InputDecoration(
              labelText: 'Username',
              hintText: 'Enter your username',
            ),
          ),
        ],
      ),
    );
  }
}
