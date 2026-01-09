import 'package:flutter/material.dart';
import 'package:dio/dio.dart';

class GiphyPicker extends StatefulWidget {
  final Function(String) onSelected;

  const GiphyPicker({super.key, required this.onSelected});

  @override
  State<GiphyPicker> createState() => _GiphyPickerState();
}

class _GiphyPickerState extends State<GiphyPicker> {
  final _searchController = TextEditingController();
  List<String> _gifs = [];
  bool _isLoading = false;
  final String _apiKey = 'dc6zaTOxFJmzC'; // Public beta key

  @override
  void initState() {
    super.initState();
    _searchGifs('trending');
  }

  Future<void> _searchGifs(String query) async {
    setState(() => _isLoading = true);
    try {
      final response = await Dio().get(
        'https://api.giphy.com/v1/gifs/${query == 'trending' ? 'trending' : 'search'}',
        queryParameters: {
          'api_key': _apiKey,
          'q': query,
          'limit': 20,
          'rating': 'g',
        },
      );

      final List data = response.data['data'];
      setState(() {
        _gifs = data.map((g) => g['images']['fixed_height']['url'] as String).toList();
        _isLoading = false;
      });
    } catch (e) {
      debugPrint('Giphy error: $e');
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.7,
      padding: const EdgeInsets.all(16),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        children: [
          TextField(
            controller: _searchController,
            decoration: InputDecoration(
              hintText: 'Search Giphy...',
              suffixIcon: IconButton(
                icon: const Icon(Icons.search),
                onPressed: () => _searchGifs(_searchController.text),
              ),
            ),
            onSubmitted: _searchGifs,
          ),
          const SizedBox(height: 16),
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : GridView.builder(
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      crossAxisSpacing: 8,
                      mainAxisSpacing: 8,
                    ),
                    itemCount: _gifs.length,
                    itemBuilder: (context, index) {
                      return GestureDetector(
                        onTap: () {
                          widget.onSelected(_gifs[index]);
                          Navigator.pop(context);
                        },
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: Image.network(_gifs[index], fit: BoxFit.cover),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
